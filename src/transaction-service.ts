import type {
  TransactionEntity,
} from '@actual-app/api/@types/loot-core/types/models';
import type {
  ActualApiServiceI,
  LlmServiceI,
  PromptGeneratorI,
  TransactionServiceI,
} from './types';
import { isFeatureEnabled } from './config';
import TagService from './transaction/tag-service';
import RuleMatchHandler from './transaction/rule-match-handler';
import ExistingCategoryHandler from './transaction/existing-category-handler';
import NewCategoryHandler from './transaction/new-category-handler';
import CategorySuggester from './transaction/category-suggester';

const BATCH_SIZE = 20;

class TransactionService implements TransactionServiceI {
  private readonly actualApiService: ActualApiServiceI;

  private readonly llmService: LlmServiceI;

  private readonly promptGenerator: PromptGeneratorI;

  private readonly notGuessedTag: string;

  private readonly tagService: TagService;

  private readonly ruleMatchHandler: RuleMatchHandler;

  private readonly existingCategoryHandler: ExistingCategoryHandler;

  private readonly newCategoryHandler: NewCategoryHandler;

  private readonly categorySuggester: CategorySuggester;

  constructor(
    actualApiClient: ActualApiServiceI,
    llmService: LlmServiceI,
    promptGenerator: PromptGeneratorI,
    notGuessedTag: string,
    tagService: TagService,
    ruleMatchHandler: RuleMatchHandler,
    existingCategoryHandler: ExistingCategoryHandler,
    newCategoryHandler: NewCategoryHandler,
    categorySuggester: CategorySuggester,
  ) {
    this.actualApiService = actualApiClient;
    this.llmService = llmService;
    this.promptGenerator = promptGenerator;
    this.notGuessedTag = notGuessedTag;
    this.tagService = tagService;
    this.ruleMatchHandler = ruleMatchHandler;
    this.existingCategoryHandler = existingCategoryHandler;
    this.newCategoryHandler = newCategoryHandler;
    this.categorySuggester = categorySuggester;
  }

  async processTransactions(): Promise<void> {
    if (isFeatureEnabled('dryRun')) {
      console.log('=== DRY RUN MODE ===');
      console.log('No changes will be made to transactions or categories');
      console.log('=====================');
    }

    const [categoryGroups, categories, payees, transactions, accounts, rules] = await Promise.all([
      this.actualApiService.getCategoryGroups(),
      this.actualApiService.getCategories(),
      this.actualApiService.getPayees(),
      this.actualApiService.getTransactions(),
      this.actualApiService.getAccounts(),
      this.actualApiService.getRules(),
    ]);
    const accountsToSkip = accounts?.filter((account) => account.offbudget)
      .map((account) => account.id) ?? [];
    console.log(`Found ${rules.length} transaction categorization rules`);

    console.log('rerunMissedTransactions', isFeatureEnabled('rerunMissedTransactions'));

    const uncategorizedTransactions = transactions.filter(
      (transaction) => !transaction.category
        && (transaction.transfer_id === null || transaction.transfer_id === undefined)
        && transaction.starting_balance_flag !== true
        && transaction.imported_payee !== null
        && transaction.imported_payee !== ''
        && (
          isFeatureEnabled('rerunMissedTransactions')
            ? true // Include all if rerun enabled
            : !transaction.notes?.includes(this.notGuessedTag)
        )
        && !transaction.is_parent
        && !accountsToSkip.includes(transaction.account),
    );

    if (uncategorizedTransactions.length === 0) {
      console.log('No uncategorized transactions to process');
      return;
    }

    console.log(`Found ${uncategorizedTransactions.length} uncategorized transactions`);

    // Track suggested new categories
    const suggestedCategories = new Map<string, {
      name: string;
      groupName: string;
      groupIsNew: boolean;
      groupId?: string;
      transactions: TransactionEntity[];
    }>();

    // Process transactions in batches
    for (
      let batchStart = 0;
      batchStart < uncategorizedTransactions.length;
      batchStart += BATCH_SIZE
    ) {
      const batchEnd = Math.min(batchStart + BATCH_SIZE, uncategorizedTransactions.length);
      console.log(`Processing batch ${batchStart / BATCH_SIZE + 1} (transactions ${batchStart + 1}-${batchEnd})`);

      const batch = uncategorizedTransactions.slice(batchStart, batchEnd);

      await batch.reduce(async (previousPromise, transaction, batchIndex) => {
        await previousPromise;
        const globalIndex = batchStart + batchIndex;
        console.log(
          `${globalIndex + 1}/${uncategorizedTransactions.length} Processing transaction '${transaction.imported_payee}'`,
        );

        try {
          const prompt = this.promptGenerator.generate(
            categoryGroups,
            transaction,
            payees,
            rules,
          );

          const response = await this.llmService.ask(prompt);

          if (response.type === 'rule' && response.ruleName && response.categoryId) {
            await this.ruleMatchHandler.handleRuleMatch(transaction, {
              ruleName: response.ruleName,
              categoryId: response.categoryId,
            }, categories);
          } else if (response.type === 'existing' && response.categoryId) {
            await this.existingCategoryHandler.handleExistingCategory(transaction, {
              categoryId: response.categoryId,
            }, categories);
          } else if (response.type === 'new' && response.newCategory) {
            this.newCategoryHandler.trackNewCategory(
              transaction,
              response.newCategory,
              suggestedCategories,
            );
          } else {
            console.warn(`Unexpected response format: ${JSON.stringify(response)}`);
            await this.actualApiService.updateTransactionNotes(
              transaction.id,
              this.tagService.appendTag(transaction.notes ?? '', this.notGuessedTag),
            );
          }
        } catch (error) {
          console.error(`Error processing transaction ${globalIndex + 1}:`, error);
          await this.actualApiService.updateTransactionNotes(
            transaction.id,
            this.tagService.appendTag(transaction.notes ?? '', this.notGuessedTag),
          );
        }
      }, Promise.resolve());

      // Add a small delay between batches to avoid overwhelming the API
      if (batchEnd < uncategorizedTransactions.length) {
        console.log('Pausing for 2 seconds before next batch...');
        await new Promise((resolve) => {
          setTimeout(resolve, 2000);
        });
      }
    }

    // Create new categories if not in dry run mode
    if (isFeatureEnabled('suggestNewCategories') && suggestedCategories.size > 0) {
      await this.categorySuggester.suggest(
        suggestedCategories,
        uncategorizedTransactions,
        categoryGroups,
      );
    }
  }
}

export default TransactionService;
