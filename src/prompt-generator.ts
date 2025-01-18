import { APICategoryGroupEntity, APIPayeeEntity } from '@actual-app/api/@types/loot-core/server/api-models';
import { TransactionEntity } from '@actual-app/api/@types/loot-core/types/models';
import * as handlebars from 'handlebars';
import { PromptGeneratorI } from './types';
import PromptTemplateException from './exceptions/prompt-template-exception';

class PromptGenerator implements PromptGeneratorI {
  private readonly promptTemplate: string;

  constructor(promptTemplate: string) {
    this.promptTemplate = promptTemplate;
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
}

export default PromptGenerator;
