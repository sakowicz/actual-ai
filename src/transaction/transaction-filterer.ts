import { TransactionEntity } from '@actual-app/api/@types/loot-core/types/models';
import { APIAccountEntity } from '@actual-app/api/@types/loot-core/server/api-models';
import { isFeatureEnabled } from '../config';
import TagService from './tag-service';

class TransactionFilterer {
  private readonly tagService: TagService;

  constructor(tagService: TagService) {
    this.tagService = tagService;
  }

  private applyFilter(
    transactions: TransactionEntity[],
    filterFn: (transaction: TransactionEntity) => boolean,
    logMessage: string,
  ): TransactionEntity[] {
    const excludedTransactions = transactions.filter((transaction) => !filterFn(transaction));

    if (excludedTransactions.length > 0) {
      console.log(`${logMessage} - Excluded ${excludedTransactions.length} transactions`);
    }

    return transactions.filter((transaction) => filterFn(transaction));
  }

  public filterUncategorized(
    transactions: TransactionEntity[],
    accounts: APIAccountEntity[],
  ): TransactionEntity[] {
    console.log(`All transactions count: ${transactions.length}`);
    console.log(`All accounts: ${accounts.length}`);

    const accountsToSkip = accounts?.filter((account) => account.offbudget)
      .map((account) => account.id) ?? [];
    console.log(`Accounts off budget: ${accountsToSkip.length}`);

    let filteredTransactions = transactions;

    // Apply filters one by one
    filteredTransactions = this.applyFilter(
      filteredTransactions,
      (transaction) => !transaction.category,
      'no category',
    );

    filteredTransactions = this.applyFilter(
      filteredTransactions,
      (transaction) => transaction.transfer_id === null || transaction.transfer_id === undefined,
      'transfer_id is not null or undefined',
    );

    filteredTransactions = this.applyFilter(
      filteredTransactions,
      (transaction) => transaction.starting_balance_flag !== true,
      'starting_balance_flag is true',
    );

    filteredTransactions = this.applyFilter(
      filteredTransactions,
      (transaction) => (transaction.imported_payee !== null && transaction.imported_payee !== '')
          || (transaction.payee !== null && transaction.payee !== ''),
      'payee is null or empty',
    );

    filteredTransactions = this.applyFilter(
      filteredTransactions,
      (transaction) => isFeatureEnabled('rerunMissedTransactions') || !this.tagService.isNotGuessed(transaction.notes ?? ''),
      'transaction has notes with the notGuessedTag',
    );

    filteredTransactions = this.applyFilter(
      filteredTransactions,
      (transaction) => !transaction.is_parent,
      'transaction is a parent',
    );

    filteredTransactions = this.applyFilter(
      filteredTransactions,
      (transaction) => !accountsToSkip.includes(transaction.account),
      'account is in the off-budget list',
    );

    console.log(`Found ${filteredTransactions.length} uncategorized transactions`);

    return filteredTransactions;
  }
}

export default TransactionFilterer;
