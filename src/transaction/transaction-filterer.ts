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

    // Find the 'AI Reclassify' category ID
    const aiReclassifyCategory = categories.find(
      (cat) => 'name' in cat && cat.name === 'AI Reclassify',
    );
    const aiReclassifyCategoryId = aiReclassifyCategory?.id;
    if (aiReclassifyCategoryId) {
      console.log(`Found 'AI Reclassify' category: ${aiReclassifyCategoryId}`);
    }

    let filteredTransactions = transactions;

    // Apply filters one by one
    filteredTransactions = this.applyFilter(
      filteredTransactions,
      (transaction) => !transaction.category || transaction.category === aiReclassifyCategoryId,
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
      (transaction) => {
        const notes = transaction.notes ?? '';
        const hasNoterTags = notes.includes('#PayPal-Payee')
          || notes.includes('#PayPal-Item-Title')
          || notes.includes('#eBay-Seller-Name')
          || notes.includes('#eBay-Product-Name')
          || notes.includes('#Amazon-Product-Name')
          || notes.includes('#Amazon-Order-ID');

        return (transaction.imported_payee !== null && transaction.imported_payee !== '')
          || (transaction.payee !== null && transaction.payee !== '')
          || hasNoterTags
          || (!!transaction.parent_id && notes.trim() !== '');
      },
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
      (transaction) => {
        if (isFeatureEnabled('includeIncome') || transaction.amount <= 0) {
          return true;
        }
        if (aiReclassifyCategoryId && transaction.category === aiReclassifyCategoryId) {
          return true;
        }

        // Special case: Amazon refunds with noter tags are examined even if includeIncome is disabled
        if (isFeatureEnabled('amazonNoterWorkflow')) {
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

          if (isTxAmazon || isParentAmazon) {
            const parentHasUploaderNotes = parent
              ? (parent.notes ?? '').includes('#Amazon-Product-Name')
                || (parent.notes ?? '').includes('#Amazon-Product-Name-Split-')
                || (parent.notes ?? '').includes('#Amazon-Order-ID')
              : false;

            const hasUploaderNotes = (transaction.notes ?? '').includes('#Amazon-Product-Name')
              || (transaction.notes ?? '').includes('#Amazon-Product-Name-Split-')
              || parentHasUploaderNotes;

            if (hasUploaderNotes) {
              return true;
            }
          }
        }

        return false;
      },
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
        const parentHasUploaderNotes = parent
          ? (parent.notes ?? '').includes('#Amazon-Product-Name')
            || (parent.notes ?? '').includes('#Amazon-Product-Name-Split-')
            || (parent.notes ?? '').includes('#Amazon-Order-ID')
          : false;

        const hasUploaderNotes = (transaction.notes ?? '').includes('#Amazon-Product-Name')
          || (transaction.notes ?? '').includes('#Amazon-Product-Name-Split-')
          || parentHasUploaderNotes;

        const isExplicitReclassify = aiReclassifyCategoryId && transaction.category === aiReclassifyCategoryId;
        const shouldIgnore = isAmazon && !hasUploaderNotes && !isExplicitReclassify;

        if (shouldIgnore) {
          const identifier = payeeName || transaction.imported_payee || 'Unknown Payee';
          console.log(
            `Ignoring raw Amazon transaction (waiting for noter): [Payee: ${identifier}, `
            + `Notes: "${transaction.notes || ''}", Amount: ${transaction.amount}]`,
          );
        }
        return !shouldIgnore;
      },
      'Is Amazon transaction (amazonNoterWorkflow enabled)',
    );

    filteredTransactions = this.applyFilter(
      filteredTransactions,
      (transaction) => {
        if (!isFeatureEnabled('paypalNoterWorkflow')) {
          return true;
        }

        const containsPaypal = (str: string | null | undefined): boolean => {
          if (!str) return false;
          const lower = str.toLowerCase();
          return lower.includes('paypal') || lower.includes('pypl');
        };

        const payeeName = payees.find((p) => p.id === transaction.payee)?.name;

        const isTxPaypal = containsPaypal(transaction.imported_payee)
          || containsPaypal(transaction.notes)
          || containsPaypal(payeeName);

        const parent = transaction.parent_id
          ? transactions.find((t) => t.id === transaction.parent_id)
          : undefined;

        const isParentPaypal = parent
          ? containsPaypal(parent.imported_payee)
            || containsPaypal(parent.notes)
            || containsPaypal(payees.find((p) => p.id === parent.payee)?.name)
          : false;

        const isPaypal = isTxPaypal || isParentPaypal;
        const hasUploaderNotes = (transaction.notes ?? '').includes('#PayPal-Item-Title')
          || (transaction.notes ?? '').includes('#PayPal-Product-Name-Split-')
          || !!parent; // If this is a child sub-transaction, it has already been matched and split by the noter

        const isExplicitReclassify = aiReclassifyCategoryId && transaction.category === aiReclassifyCategoryId;
        const shouldIgnore = isPaypal && !hasUploaderNotes && !isExplicitReclassify;

        if (shouldIgnore) {
          const identifier = payeeName || transaction.imported_payee || 'Unknown Payee';
          console.log(
            `Ignoring raw PayPal transaction (waiting for noter): [Payee: ${identifier}, `
            + `Notes: "${transaction.notes || ''}", Amount: ${transaction.amount}]`,
          );
        }
        return !shouldIgnore;
      },
      'Is PayPal transaction (paypalNoterWorkflow enabled)',
    );

    filteredTransactions = this.applyFilter(
      filteredTransactions,
      (transaction) => {
        if (!isFeatureEnabled('ebayNoterWorkflow')) {
          return true;
        }

        const containsEbay = (str: string | null | undefined): boolean => {
          if (!str) return false;
          const lower = str.toLowerCase();
          return lower.includes('ebay');
        };

        const payeeName = payees.find((p) => p.id === transaction.payee)?.name;

        const isTxEbay = containsEbay(transaction.imported_payee)
          || containsEbay(transaction.notes)
          || containsEbay(payeeName);

        const parent = transaction.parent_id
          ? transactions.find((t) => t.id === transaction.parent_id)
          : undefined;

        const isParentEbay = parent
          ? containsEbay(parent.imported_payee)
            || containsEbay(parent.notes)
            || containsEbay(payees.find((p) => p.id === parent.payee)?.name)
          : false;

        const isEbay = isTxEbay || isParentEbay;

        const parentHasUploaderNotes = parent
          ? (parent.notes ?? '').includes('#eBay-Product-Name')
            || (parent.notes ?? '').includes('#eBay-Product-Name-Split-')
            || (parent.notes ?? '').includes('#eBay-Order-ID')
          : false;

        const hasUploaderNotes = (transaction.notes ?? '').includes('#eBay-Product-Name')
          || (transaction.notes ?? '').includes('#eBay-Product-Name-Split-')
          || (transaction.notes ?? '').includes('#eBay-Order-ID')
          || parentHasUploaderNotes;

        const isExplicitReclassify = aiReclassifyCategoryId && transaction.category === aiReclassifyCategoryId;
        const shouldIgnore = isEbay && !hasUploaderNotes && !isExplicitReclassify;

        if (shouldIgnore) {
          const identifier = payeeName || transaction.imported_payee || 'Unknown Payee';
          console.log(
            `Ignoring raw eBay transaction (waiting for noter): [Payee: ${identifier}, `
            + `Notes: "${transaction.notes || ''}", Amount: ${transaction.amount}]`,
          );
        }
        return !shouldIgnore;
      },
      'Is eBay transaction (ebayNoterWorkflow enabled)',
    );

    console.log(`Found ${filteredTransactions.length} uncategorized transactions`);

    return filteredTransactions;
  }
}

export default TransactionFilterer;
