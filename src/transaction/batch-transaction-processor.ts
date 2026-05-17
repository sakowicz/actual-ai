import {
  RuleEntity,
  TransactionEntity,
} from '@actual-app/core/src/types/models';
import { APIPayeeEntity } from '@actual-app/core/src/server/api-models';
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

      await this.transactionProcessor.process(
        batch,
        categoryGroups,
        payees,
        rules,
        categories,
        suggestedCategories,
      );

      // Add a small delay between batches to avoid overwhelming the API
      if (batchEnd < uncategorizedTransactions.length) {
        console.log('Pausing for 13 seconds before next batch (rate limit: 5 RPM)...');
        await new Promise((resolve) => {
          setTimeout(resolve, 13000);
        });
      }
    }
  }
}

export default BatchTransactionProcessor;
