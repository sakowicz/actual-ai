import type { TransactionEntity } from '@actual-app/api/@types/loot-core/types/models';
import type {
  CategorySuggestion,
} from '../types';

class NewCategoryHandler {
  public trackNewCategory(
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

export default NewCategoryHandler;
