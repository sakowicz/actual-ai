import type {
  TransactionEntity,
} from '@actual-app/api/@types/loot-core/types/models';
import type {
  ActualApiServiceI,
  TransactionServiceI,
} from './types';
import { isFeatureEnabled } from './config';
import CategorySuggester from './transaction/category-suggester';
import TransactionProcessor from './transaction/transaction-processor';

class TransactionService implements TransactionServiceI {
  private readonly actualApiService: ActualApiServiceI;

  private readonly notGuessedTag: string;

  private readonly categorySuggester: CategorySuggester;

  private readonly transactionProcessor: TransactionProcessor;

  constructor(
    actualApiClient: ActualApiServiceI,
    notGuessedTag: string,
    categorySuggester: CategorySuggester,
    transactionProcessor: TransactionProcessor,
  ) {
    this.actualApiService = actualApiClient;
    this.notGuessedTag = notGuessedTag;
    this.categorySuggester = categorySuggester;
    this.transactionProcessor = transactionProcessor;
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

    await this.transactionProcessor.process(
      uncategorizedTransactions,
      categoryGroups,
      payees,
      rules,
      categories,
      suggestedCategories,
    );

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
