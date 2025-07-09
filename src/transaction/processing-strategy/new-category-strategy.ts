import { CategoryEntity, TransactionEntity } from '@actual-app/api/@types/loot-core/src/types/models';
import type {
  ProcessingStrategyI, UnifiedResponse,
} from '../../types';

class NewCategoryStrategy implements ProcessingStrategyI {
  public isSatisfiedBy(response: UnifiedResponse): boolean {
    if (response.newCategory === undefined) {
      return false;
    }
    return response.type === 'new';
  }

  public async process(
    transaction: TransactionEntity,
    response: UnifiedResponse,
    categories: CategoryEntity[],
    suggestedCategories: Map<string, {
        name: string;
        groupName: string;
        groupIsNew: boolean;
        groupId?: string;
        transactions: TransactionEntity[];
      }>,
  ) {
    if (response.newCategory === undefined) {
      throw new Error('No newCategory in response');
    }
    const categoryKey = `${response.newCategory.groupName}:${response.newCategory.name}`;

    const existing = suggestedCategories.get(categoryKey);
    if (existing) {
      existing.transactions.push(transaction);
    } else {
      suggestedCategories.set(categoryKey, {
        ...response.newCategory,
        transactions: [transaction],
      });
    }
    return Promise.resolve();
  }
}

export default NewCategoryStrategy;
