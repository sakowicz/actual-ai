import { APICategoryGroupEntity, APIPayeeEntity } from '@actual-app/api/@types/loot-core/server/api-models';
import { RuleEntity, TransactionEntity } from '@actual-app/api/@types/loot-core/types/models';
import { APICategoryEntity, PromptGeneratorI, RuleDescription } from '../../src/types';

export default class MockedPromptGenerator implements PromptGeneratorI {
  generate(
    _categoryGroups: APICategoryGroupEntity[],
    _transaction: TransactionEntity,
    _payees: APIPayeeEntity[],
    _rules?: RuleEntity[],
  ): string {
    return 'mocked prompt';
  }

  transformRulesToDescriptions(
    _rules: RuleEntity[],
    _categories: APICategoryEntity[],
    _payees: APIPayeeEntity[],
  ): RuleDescription[] {
    return [];
  }
}
