import { APICategoryGroupEntity, APIPayeeEntity } from '@actual-app/api/@types/loot-core/server/api-models';
import { TransactionEntity } from '@actual-app/api/@types/loot-core/types/models';
import * as handlebars from 'handlebars';
import { PromptGeneratorI } from './types';
import PromptTemplateException from './exceptions/prompt-template-exception';

class PromptGenerator implements PromptGeneratorI {
  private readonly promptTemplate: string;

  private readonly categorySuggestionTemplate: string;

  constructor(promptTemplate: string, categorySuggestionTemplate: string) {
    this.promptTemplate = promptTemplate;
    this.categorySuggestionTemplate = categorySuggestionTemplate;
  }

  generate(
    categoryGroups: APICategoryGroupEntity[],
    transaction: TransactionEntity,
    payees: APIPayeeEntity[],
  ): string {
    let template;
    try {
      template = handlebars.compile(this.promptTemplate);
    } catch (error) {
      console.error('Error generating prompt. Check syntax of your template.', error);
      throw new PromptTemplateException('Error generating prompt. Check syntax of your template.');
    }
    const payeeName = payees.find((payee) => payee.id === transaction.payee)?.name;

    try {
      return template({
        categoryGroups,
        amount: Math.abs(transaction.amount),
        type: transaction.amount > 0 ? 'Income' : 'Outcome',
        description: transaction.notes,
        payee: payeeName,
        importedPayee: transaction.imported_payee,
        date: transaction.date,
        cleared: transaction.cleared,
        reconciled: transaction.reconciled,
      });
    } catch (error) {
      console.error('Error generating prompt. Check syntax of your template.', error);
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
    } catch (error) {
      console.error('Error generating category suggestion prompt.', error);
      throw new PromptTemplateException('Error generating category suggestion prompt.');
    }

    const payeeName = payees.find((payee) => payee.id === transaction.payee)?.name;

    try {
      return template({
        categoryGroups,
        amount: Math.abs(transaction.amount),
        type: transaction.amount > 0 ? 'Income' : 'Outcome',
        description: transaction.notes,
        payee: payeeName,
        importedPayee: transaction.imported_payee,
        date: transaction.date,
        cleared: transaction.cleared,
        reconciled: transaction.reconciled,
      });
    } catch (error) {
      console.error('Error generating category suggestion prompt.', error);
      throw new PromptTemplateException('Error generating category suggestion prompt.');
    }
  }
}

export default PromptGenerator;
