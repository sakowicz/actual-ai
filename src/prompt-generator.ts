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

  private readonly categorySuggestionTemplate: string;

  private readonly similarRulesTemplate: string;

  constructor(
    promptTemplate: string,
    categorySuggestionTemplate = '',
    similarRulesTemplate = '',
  ) {
    this.promptTemplate = promptTemplate;
    this.categorySuggestionTemplate = categorySuggestionTemplate;
    this.similarRulesTemplate = similarRulesTemplate;
  }

  generate(
    categoryGroups: APICategoryGroupEntity[],
    transaction: TransactionEntity,
    payees: APIPayeeEntity[],
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

    try {
      return template({
        categoryGroups: groupsWithCategories,
        amount: Math.abs(transaction.amount),
        type: transaction.amount > 0 ? 'Income' : 'Outcome',
        description: transaction.notes,
        payee: payeeName,
        importedPayee: transaction.imported_payee,
        date: transaction.date,
        cleared: transaction.cleared,
        reconciled: transaction.reconciled,
      });
    } catch {
      console.error('Error generating prompt. Check syntax of your template.');
      throw new PromptTemplateException('Error generating prompt. Check syntax of your template.');
    }
  }

  generateCategorySuggestion(
    categoryGroups: APICategoryGroupEntity[],
    transaction: TransactionEntity,
    payees: APIPayeeEntity[],
  ): string {
    let template;
    try {
      template = handlebars.compile(this.categorySuggestionTemplate);
    } catch {
      console.error('Error generating category suggestion prompt.');
      throw new PromptTemplateException('Error generating category suggestion prompt.');
    }

    const payeeName = payees.find((payee) => payee.id === transaction.payee)?.name;

    // Ensure each category group has its categories property
    const groupsWithCategories = categoryGroups.map((group) => ({
      ...group,
      groupName: group.name,
      categories: group.categories ?? [],
    }));

    try {
      const webSearchEnabled = typeof hasWebSearchTool === 'boolean' ? hasWebSearchTool : false;
      return template({
        categoryGroups: groupsWithCategories,
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
      console.error('Error generating category suggestion prompt.');
      throw new PromptTemplateException('Error generating category suggestion prompt.');
    }
  }

  generateSimilarRulesPrompt(
    transaction: TransactionEntity & { payeeName?: string },
    rulesDescription: RuleDescription[],
  ): string {
    let template;
    try {
      template = handlebars.compile(this.similarRulesTemplate);
    } catch {
      console.error('Error generating similar rules prompt.');
      throw new PromptTemplateException('Error generating similar rules prompt.');
    }

    try {
      // Add index to each rule for numbering
      const rulesWithIndex = rulesDescription.map((rule, index) => ({
        ...rule,
        index,
      }));

      // Use payeeName if available, otherwise use imported_payee
      const payee = transaction.payeeName ?? transaction.imported_payee;

      return template({
        amount: Math.abs(transaction.amount),
        type: transaction.amount > 0 ? 'Income' : 'Outcome',
        description: transaction.notes,
        importedPayee: transaction.imported_payee,
        payee,
        date: transaction.date,
        rules: rulesWithIndex,
      });
    } catch (error) {
      console.error('Error generating similar rules prompt:', error);
      throw new PromptTemplateException('Error generating similar rules prompt.');
    }
  }

  transformRulesToDescriptions(
    rules: RuleEntity[],
    categories: APICategoryEntity[],
    payees: APIPayeeEntity[] = [],
  ): RuleDescription[] {
    return transformRulesToDescriptions(rules, categories, payees);
  }

  generateUnifiedPrompt(
    categoryGroups: APICategoryGroupEntity[],
    transaction: TransactionEntity,
    payees: APIPayeeEntity[],
    rules: RuleEntity[],
  ): string {
    const template = handlebars.compile(this.promptTemplate);
    const payeeName = payees.find((p) => p.id === transaction.payee)?.name;

    const categories = categoryGroups.flatMap((group) => (group.categories ?? []).map((cat) => ({
      ...cat,
      groupName: group.name,
    })));

    const rulesDescription = this.transformRulesToDescriptions(
      rules,
      categories as APICategoryEntity[],
      payees,
    );

    return template({
      categoryGroups: categoryGroups.map((g) => ({
        ...g,
        categories: g.categories ?? [],
      })),
      rules: rulesDescription,
      amount: Math.abs(transaction.amount),
      type: transaction.amount > 0 ? 'Income' : 'Expense',
      description: transaction.notes,
      payee: payeeName,
      importedPayee: transaction.imported_payee,
      date: transaction.date,
    });
  }
}

export default PromptGenerator;
