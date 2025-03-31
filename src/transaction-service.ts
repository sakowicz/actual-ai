import type {
  CategoryEntity,
  TransactionEntity,
} from '@actual-app/api/@types/loot-core/types/models';
import type {
  ActualApiServiceI,
  LlmServiceI,
  PromptGeneratorI,
  TransactionServiceI,
  CategorySuggestion,
} from './types';
import { isFeatureEnabled } from './config';
import CategorySuggestionOptimizer from './category-suggestion-optimizer';

const LEGACY_NOTES_NOT_GUESSED = 'actual-ai could not guess this category';
const LEGACY_NOTES_GUESSED = 'actual-ai guessed this category';
const BATCH_SIZE = 20;

class TransactionService implements TransactionServiceI {
  private readonly actualApiService: ActualApiServiceI;

  private readonly llmService: LlmServiceI;

  private readonly promptGenerator: PromptGeneratorI;

  private readonly categorySuggestionOptimizer: CategorySuggestionOptimizer;

  private readonly notGuessedTag: string;

  private readonly guessedTag: string;

  constructor(
    actualApiClient: ActualApiServiceI,
    llmService: LlmServiceI,
    promptGenerator: PromptGeneratorI,
    categorySuggestionOptimizer: CategorySuggestionOptimizer,
    notGuessedTag: string,
    guessedTag: string,
  ) {
    this.actualApiService = actualApiClient;
    this.llmService = llmService;
    this.promptGenerator = promptGenerator;
    this.categorySuggestionOptimizer = categorySuggestionOptimizer;
    this.notGuessedTag = notGuessedTag;
    this.guessedTag = guessedTag;
  }

  appendTag(notes: string, tag: string): string {
    const clearedNotes = this.clearPreviousTags(notes);
    return `${clearedNotes} ${tag}`.trim();
  }

  clearPreviousTags(notes: string): string {
    return notes
      .replace(new RegExp(`\\s*${this.guessedTag}`, 'g'), '')
      .replace(new RegExp(`\\s*${this.notGuessedTag}`, 'g'), '')
      .replace(new RegExp(`\\s*\\|\\s*${LEGACY_NOTES_NOT_GUESSED}`, 'g'), '')
      .replace(new RegExp(`\\s*\\|\\s*${LEGACY_NOTES_GUESSED}`, 'g'), '')
      .replace(new RegExp(`\\s*${LEGACY_NOTES_GUESSED}`, 'g'), '')
      .replace(new RegExp(`\\s*${LEGACY_NOTES_NOT_GUESSED}`, 'g'), '')
      .replace(/-miss(?= #actual-ai)/g, '')
      .trim();
  }

  async migrateToTags(): Promise<void> {
    const transactions = await this.actualApiService.getTransactions();
    const transactionsToMigrate = transactions.filter(
      (transaction) => transaction.notes
        && (
          transaction.notes?.includes(LEGACY_NOTES_NOT_GUESSED)
          || transaction.notes?.includes(LEGACY_NOTES_GUESSED)
        ),
    );

    for (let i = 0; i < transactionsToMigrate.length; i++) {
      const transaction = transactionsToMigrate[i];
      console.log(`${i + 1}/${transactionsToMigrate.length} Migrating transaction ${transaction.imported_payee} / ${transaction.notes} / ${transaction.amount}`);

      const baseNotes = this.clearPreviousTags(transaction.notes ?? '');
      let newNotes = baseNotes;

      if (transaction.notes?.includes(LEGACY_NOTES_NOT_GUESSED)) {
        newNotes = this.appendTag(baseNotes, this.notGuessedTag);
      } else if (transaction.notes?.includes(LEGACY_NOTES_GUESSED)) {
        newNotes = this.appendTag(baseNotes, this.guessedTag);
      }

      if (newNotes !== transaction.notes) {
        await this.actualApiService.updateTransactionNotes(transaction.id, newNotes);
      }
    }
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
            await this.handleRuleMatch(transaction, {
              ruleName: response.ruleName,
              categoryId: response.categoryId,
            }, categories);
          } else if (response.type === 'existing' && response.categoryId) {
            await this.handleExistingCategory(transaction, {
              categoryId: response.categoryId,
            }, categories);
          } else if (response.type === 'new' && response.newCategory) {
            this.trackNewCategory(
              transaction,
              response.newCategory,
              suggestedCategories,
            );
          } else {
            console.warn(`Unexpected response format: ${JSON.stringify(response)}`);
            await this.actualApiService.updateTransactionNotes(
              transaction.id,
              this.appendTag(transaction.notes ?? '', this.notGuessedTag),
            );
          }
        } catch (error) {
          console.error(`Error processing transaction ${globalIndex + 1}:`, error);
          await this.actualApiService.updateTransactionNotes(
            transaction.id,
            this.appendTag(transaction.notes ?? '', this.notGuessedTag),
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
      // Optimize categories before applying/reporting
      const optimizedCategories = this.categorySuggestionOptimizer
        .optimizeCategorySuggestions(suggestedCategories);

      if (isFeatureEnabled('dryRun')) {
        console.log(`\nDRY RUN: Would create ${optimizedCategories.size} new categories after optimization:`);
        Array.from(optimizedCategories.entries()).forEach(([_, suggestion]) => {
          console.log(
            `- ${suggestion.name} in ${suggestion.groupIsNew ? 'new' : 'existing'} group "${suggestion.groupName}"`,
            `for ${suggestion.transactions.length} transactions`,
          );
        });
      } else if (isFeatureEnabled('dryRunNewCategories')) {
        console.log(`\nDRY RUN CATEGORIES: Would create ${optimizedCategories.size} new categories:`);
        Array.from(optimizedCategories.entries()).forEach(([_, suggestion]) => {
          console.log(
            `- ${suggestion.name} in ${suggestion.groupIsNew ? 'new' : 'existing'} group "${suggestion.groupName}"`,
            `for ${suggestion.transactions.length} transactions`,
          );
        });

        // Don't create categories but log which transactions would be affected
        uncategorizedTransactions.forEach((uncategorizedTransaction) => {
          // Skip transactions needing new categories in dry run mode
          console.log(
            `Skipping categorization for '${uncategorizedTransaction.imported_payee}' `
            + 'as it needs a new category',
          );
        });
      } else {
        console.log(`Creating ${optimizedCategories.size} optimized categories`);

        // Use optimized categories instead of original suggestions
        await Promise.all(
          Array.from(optimizedCategories.entries()).map(async ([_key, suggestion]) => {
            try {
              // First, ensure we have a group ID
              let groupId: string;
              if (suggestion.groupIsNew) {
                groupId = await this.actualApiService.createCategoryGroup(suggestion.groupName);
                console.log(`Created new category group "${suggestion.groupName}" with ID ${groupId}`);
              } else {
                // Find existing group with matching name
                const existingGroup = categoryGroups.find(
                  (g) => g.name.toLowerCase() === suggestion.groupName.toLowerCase(),
                );
                groupId = existingGroup?.id
                  ?? await this.actualApiService.createCategoryGroup(
                    suggestion.groupName,
                  );
              }

              // Validate groupId exists before creating category
              if (!groupId) {
                throw new Error(`Missing groupId for category ${suggestion.name}`);
              }

              const newCategoryId = await this.actualApiService.createCategory(
                suggestion.name,
                groupId,
              );

              console.log(`Created new category "${suggestion.name}" with ID ${newCategoryId}`);

              // Use Promise.all with map for nested async operations
              await Promise.all(
                suggestion.transactions.map(async (transaction) => {
                  await this.actualApiService.updateTransactionNotesAndCategory(
                    transaction.id,
                    this.appendTag(transaction.notes ?? '', this.guessedTag),
                    newCategoryId,
                  );
                  console.log(`Assigned transaction ${transaction.id} to new category ${suggestion.name}`);
                }),
              );
            } catch (error) {
              console.error(`Error creating category ${suggestion.name}:`, error);
            }
          }),
        );
      }
    }
  }

  private async handleRuleMatch(
    transaction: TransactionEntity,
    response: { categoryId: string; ruleName: string },
    categories: CategoryEntity[],
  ) {
    const category = categories.find((c) => c.id === response.categoryId);
    const categoryName = category ? category.name : 'Unknown Category';

    if (isFeatureEnabled('dryRun')) {
      console.log(`DRY RUN: Would assign transaction ${transaction.id} to category "${categoryName}" (${response.categoryId}) via rule ${response.ruleName}`);
      return;
    }

    await this.actualApiService.updateTransactionNotesAndCategory(
      transaction.id,
      this.appendTag(transaction.notes ?? '', `${this.guessedTag} (rule: ${response.ruleName})`),
      response.categoryId,
    );
  }

  private async handleExistingCategory(
    transaction: TransactionEntity,
    response: { categoryId: string },
    categories: CategoryEntity[],
  ) {
    const category = categories.find((c) => c.id === response.categoryId);
    if (!category) {
      // Add not guessed tag when category not found
      await this.actualApiService.updateTransactionNotes(
        transaction.id,
        this.appendTag(transaction.notes ?? '', this.notGuessedTag),
      );
      return;
    }

    if (isFeatureEnabled('dryRun')) {
      console.log(`DRY RUN: Would assign transaction ${transaction.id} to existing category ${category.name}`);
      return;
    }

    console.log(`Using existing category: ${category.name}`);
    await this.actualApiService.updateTransactionNotesAndCategory(
      transaction.id,
      this.appendTag(transaction.notes ?? '', this.guessedTag),
      response.categoryId,
    );
  }

  private trackNewCategory(
    transaction: TransactionEntity,
    newCategory: CategorySuggestion,
    suggestedCategories: Map<string, {
      name: string;
      groupName: string;
      groupIsNew: boolean;
      groupId?: string;
      transactions: TransactionEntity[];
    }>,
  ) {
    const categoryKey = `${newCategory.groupName}:${newCategory.name}`;

    const existing = suggestedCategories.get(categoryKey);
    if (existing) {
      existing.transactions.push(transaction);
    } else {
      suggestedCategories.set(categoryKey, {
        ...newCategory,
        transactions: [transaction],
      });
    }
  }
}

export default TransactionService;
