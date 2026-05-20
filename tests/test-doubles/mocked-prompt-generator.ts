import { APICategoryGroupEntity, APIPayeeEntity } from '@actual-app/core/src/server/api-models';
import { RuleEntity, TransactionEntity } from '@actual-app/core/src/types/models';
import { PromptGeneratorI } from '../../src/types';

export default class MockedPromptGenerator implements PromptGeneratorI {
  generate(
    _categoryGroups: APICategoryGroupEntity[],
    transactions: TransactionEntity[],
    _payees: APIPayeeEntity[],
    _rules?: RuleEntity[],
  ): string {
    if (transactions.length > 0) {
      return `mocked prompt with Transaction ID: ${transactions[0].id}`;
    }
    return 'mocked prompt';
  }
}
