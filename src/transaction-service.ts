import type {
  TransactionEntity,
} from '@actual-app/api/@types/loot-core/types/models';
import type {
  ActualApiServiceI,
  TransactionServiceI,
} from './types';
import { isFeatureEnabled } from './config';
import CategorySuggester from './transaction/category-suggester';
import BatchTransactionProcessor from './transaction/batch-transaction-processor';
import TransactionFilterer from './transaction/transaction-filterer';

class TransactionService implements TransactionServiceI {
  private readonly actualApiService: ActualApiServiceI;

  private readonly categorySuggester: CategorySuggester;

  private readonly transactionProcessor: BatchTransactionProcessor;

  private readonly transactionFilterer: TransactionFilterer;

  constructor(
    actualApiClient: ActualApiServiceI,
    categorySuggester: CategorySuggester,
    transactionProcessor: BatchTransactionProcessor,
    transactionFilterer: TransactionFilterer,
  ) {
    this.actualApiService = actualApiClient;
    this.categorySuggester = categorySuggester;
    this.transactionProcessor = transactionProcessor;
    this.transactionFilterer = transactionFilterer;
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
    console.log(`Found ${rules.length} transaction categorization rules`);
    console.log('rerunMissedTransactions', isFeatureEnabled('rerunMissedTransactions'));

    const uncategorizedTransactions = this.transactionFilterer.filterUncategorized(
      transactions,
      accounts,
    );

    if (uncategorizedTransactions.length === 0) {
      console.log('No uncategorized transactions to process');
      return;
    }

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
