import { APIPayeeEntity } from '@actual-app/api/@types/loot-core/server/api-models';
import { RuleEntity, TransactionEntity } from '@actual-app/api/@types/loot-core/types/models';
import handlebars from './handlebars-helpers';
import {
  PromptGeneratorI, RuleDescription, APICategoryEntity, APICategoryGroupEntity,
} from './types';
import PromptTemplateException from './exceptions/prompt-template-exception';
import { hasWebSearchTool } from './config';
import { transformRulesToDescriptions } from './utils/rule-utils';

class PromptGenerator implements PromptGeneratorI {
  private readonly promptTemplate: string;

  constructor(
    promptTemplate: string,
  ) {
    this.promptTemplate = promptTemplate;
  }

  generate(
    categoryGroups: APICategoryGroupEntity[],
    transaction: TransactionEntity,
    payees: APIPayeeEntity[],
    rules: RuleEntity[],
  ): string {
    let template;
    try {
      template = handlebars.compile(this.promptTemplate);
    } catch {
      console.error('Error generating prompt. Check syntax of your template.');
      throw new PromptTemplateException('Error generating prompt. Check syntax of your template.');
    }
    const payeeName = payees.find((payee) => payee.id === transaction.payee)?.name;

    // Ensure each category group has its categories property
    const groupsWithCategories = categoryGroups.map((group) => ({
      ...group,
      groupName: group.name,
      categories: group.categories ?? [],
    }));

    const rulesDescription = this.transformRulesToDescriptions(
      rules,
      groupsWithCategories,
      payees,
    );

    try {
      const webSearchEnabled = typeof hasWebSearchTool === 'boolean' ? hasWebSearchTool : false;
      return template({
        categoryGroups: groupsWithCategories,
        rules: rulesDescription,
        amount: Math.abs(transaction.amount),
        type: transaction.amount > 0 ? 'Income' : 'Outcome',
        description: transaction.notes ?? '',
        payee: payeeName ?? '',
        importedPayee: transaction.imported_payee ?? '',
        date: transaction.date ?? '',
        cleared: transaction.cleared,
        reconciled: transaction.reconciled,
        hasWebSearchTool: webSearchEnabled,
      });
    } catch {
      console.error('Error generating prompt. Check syntax of your template.');
      throw new PromptTemplateException('Error generating prompt. Check syntax of your template.');
    }
  }

  transformRulesToDescriptions(
    rules: RuleEntity[],
    categories: APICategoryEntity[],
    payees: APIPayeeEntity[] = [],
  ): RuleDescription[] {
    return transformRulesToDescriptions(rules, categories, payees);
  }
}

export default PromptGenerator;
