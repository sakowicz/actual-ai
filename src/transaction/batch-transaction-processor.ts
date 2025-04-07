import {
  RuleEntity,
  TransactionEntity,
} from '@actual-app/api/@types/loot-core/types/models';
import { APIPayeeEntity } from '@actual-app/api/@types/loot-core/server/api-models';
import {
  APICategoryEntity, APICategoryGroupEntity,
} from '../types';
import TransactionProcessor from './transaction-processor';

class BatchTransactionProcessor {
  private readonly transactionProcessor: TransactionProcessor;

  private readonly batchSize: number;

  constructor(
    transactionProcessor: TransactionProcessor,
    batchSize: number,
  ) {
    this.transactionProcessor = transactionProcessor;
    this.batchSize = batchSize;
  }

  public async process(
    uncategorizedTransactions: TransactionEntity[],
    categoryGroups: APICategoryGroupEntity[],
    payees: APIPayeeEntity[],
    rules: RuleEntity[],
    categories: (APICategoryEntity | APICategoryGroupEntity)[],
    suggestedCategories: Map<string, {
        name: string;
        groupName: string;
        groupIsNew: boolean;
        groupId?: string;
        transactions: TransactionEntity[];
      }>,
  ): Promise<void> {
    for (
      let batchStart = 0;
      batchStart < uncategorizedTransactions.length;
      batchStart += this.batchSize
    ) {
      const batchEnd = Math.min(batchStart + this.batchSize, uncategorizedTransactions.length);
      console.log(`Processing batch ${batchStart / this.batchSize + 1} (transactions ${batchStart + 1}-${batchEnd})`);

      const batch = uncategorizedTransactions.slice(batchStart, batchEnd);

      await batch.reduce(async (previousPromise, transaction, batchIndex) => {
        await previousPromise;
        const globalIndex = batchStart + batchIndex;
        console.log(
          `${globalIndex + 1}/${uncategorizedTransactions.length} Processing transaction '${transaction.imported_payee}'`,
        );

        await this.transactionProcessor.process(
          transaction,
          categoryGroups,
          payees,
          rules,
          categories,
          suggestedCategories,
        );
      }, Promise.resolve());

      // Add a small delay between batches to avoid overwhelming the API
      if (batchEnd < uncategorizedTransactions.length) {
        console.log('Pausing for 2 seconds before next batch...');
        await new Promise((resolve) => {
          setTimeout(resolve, 2000);
        });
      }
    }
  }
}

export default BatchTransactionProcessor;
