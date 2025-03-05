import { APICategoryGroupEntity, APIPayeeEntity } from '@actual-app/api/@types/loot-core/server/api-models';
import { TransactionEntity } from '@actual-app/api/@types/loot-core/types/models';
import { PromptGeneratorI } from '../../src/types';

export default class MockedPromptGenerator implements PromptGeneratorI {
  generate(): string {
    return 'mocked prompt';
  }

  generateCategorySuggestion(
    _categoryGroups: APICategoryGroupEntity[],
    _transaction: TransactionEntity,
    _payees: APIPayeeEntity[],
  ): string {
    return 'mocked category suggestion prompt';
  }

  generateSimilarRulesPrompt(
    _transaction: TransactionEntity,
    _rulesDescription: {
      ruleName: string;
      conditions: string;
      categoryName: string;
      categoryId: string;
      index?: number;
    }[],
  ): string {
    return 'mocked similar rules prompt';
  }
}
