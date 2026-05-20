import { TransactionEntity } from '@actual-app/core/src/types/models';
import { APIAccountEntity, APIPayeeEntity } from '@actual-app/core/src/server/api-models';
import { APICategoryEntity, APICategoryGroupEntity } from '../types';
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
    categories: (APICategoryEntity | APICategoryGroupEntity)[] = [],
    payees: APIPayeeEntity[] = [],
  ): TransactionEntity[] {
    console.log(`All transactions count: ${transactions.length}`);
    console.log(`All accounts: ${accounts.length}`);

    const accountsToSkip = accounts?.filter((account) => account.offbudget)
      .map((account) => account.id) ?? [];
    console.log(`Accounts off budget: ${accountsToSkip.length}`);

    // Find the 'To Recategorise' category ID
    const recategoriseCategory = categories.find(
      (cat) => 'name' in cat && cat.name === 'To Recategorise',
    );
    const recategoriseCategoryId = recategoriseCategory?.id;
    if (recategoriseCategoryId) {
      console.log(`Found 'To Recategorise' category: ${recategoriseCategoryId}`);
    }

    let filteredTransactions = transactions;

    // Apply filters one by one
    filteredTransactions = this.applyFilter(
      filteredTransactions,
      (transaction) => !transaction.category || transaction.category === recategoriseCategoryId,
      'Already has a category',
    );

    filteredTransactions = this.applyFilter(
      filteredTransactions,
      (transaction) => transaction.transfer_id === null || transaction.transfer_id === undefined,
      'Is a transfer',
    );

    filteredTransactions = this.applyFilter(
      filteredTransactions,
      (transaction) => transaction.starting_balance_flag !== true,
      'Is starting balance',
    );

    filteredTransactions = this.applyFilter(
      filteredTransactions,
      (transaction) => (transaction.imported_payee !== null && transaction.imported_payee !== '')
          || (transaction.payee !== null && transaction.payee !== '')
          || (!!transaction.parent_id && (transaction.notes ?? '').trim() !== ''),
      'Has no payee / imported_payee',
    );

    filteredTransactions = this.applyFilter(
      filteredTransactions,
      (transaction) => isFeatureEnabled('rerunMissedTransactions') || !this.tagService.isNotGuessed(transaction.notes ?? ''),
      'It was not guessed before',
    );

    filteredTransactions = this.applyFilter(
      filteredTransactions,
      (transaction) => !transaction.is_parent,
      'Transaction is a parent',
    );

    filteredTransactions = this.applyFilter(
      filteredTransactions,
      (transaction) => !accountsToSkip.includes(transaction.account),
      'Account is not budget',
    );

    filteredTransactions = this.applyFilter(
      filteredTransactions,
      (transaction) => isFeatureEnabled('includeIncome') || transaction.amount <= 0,
      'Is income transaction',
    );

    filteredTransactions = this.applyFilter(
      filteredTransactions,
      (transaction) => {
        if (!isFeatureEnabled('amazonNoterWorkflow')) {
          return true;
        }

        const containsAmazon = (str: string | null | undefined): boolean => {
          if (!str) return false;
          const lower = str.toLowerCase();
          return lower.includes('amazon') || lower.includes('amzn');
        };

        const payeeName = payees.find((p) => p.id === transaction.payee)?.name;

        const isTxAmazon = containsAmazon(transaction.imported_payee)
          || containsAmazon(transaction.notes)
          || containsAmazon(payeeName);

        const parent = transaction.parent_id
          ? transactions.find((t) => t.id === transaction.parent_id)
          : undefined;

        const isParentAmazon = parent
          ? containsAmazon(parent.imported_payee)
            || containsAmazon(parent.notes)
            || containsAmazon(payees.find((p) => p.id === parent.payee)?.name)
          : false;

        const isAmazon = isTxAmazon || isParentAmazon;
        if (isAmazon) {
          const identifier = payeeName || transaction.imported_payee || 'Unknown Payee';
          console.log(
            `Ignoring Amazon transaction: [Payee: ${identifier}, `
            + `Notes: "${transaction.notes || ''}", Amount: ${transaction.amount}]`,
          );
        }
        return !isAmazon;
      },
      'Is Amazon transaction (amazonNoterWorkflow enabled)',
    );

    console.log(`Found ${filteredTransactions.length} uncategorized transactions`);

    return filteredTransactions;
  }
}

export default TransactionFilterer;
