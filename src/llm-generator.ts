import { APICategoryGroupEntity, APIPayeeEntity } from '@actual-app/api/@types/loot-core/server/api-models';
import { TransactionEntity } from '@actual-app/api/@types/loot-core/types/models';

class LlmGenerator {
  static generatePrompt(
    categoryGroups: APICategoryGroupEntity[],
    transaction: TransactionEntity,
    payees: APIPayeeEntity[],
  ): string {
    let prompt = 'I want to categorize the given bank transactions into the following categories:\n';
    categoryGroups.forEach((categoryGroup) => {
      categoryGroup.categories.forEach((category) => {
        prompt += `* ${category.name} (${categoryGroup.name}) (ID: "${category.id}") \n`;
      });
    });

    const payeeName = payees.find((payee) => payee.id === transaction.payee)?.name;

    prompt += 'Please categorize the following transaction: \n';
    prompt += `* Amount: ${Math.abs(transaction.amount)}\n`;
    prompt += `* Type: ${transaction.amount > 0 ? 'Income' : 'Outcome'}\n`;
    prompt += `* Description: ${transaction.notes ?? ''}\n`;
    if (payeeName && payeeName !== transaction.imported_payee) {
      prompt += `* Payee: ${payeeName}\n`;
      prompt += `* Payee RAW: ${transaction.imported_payee}\n`;
    } else {
      prompt += `* Payee: ${transaction.imported_payee}\n`;
    }

    prompt += 'ANSWER BY A CATEGORY ID. DO NOT WRITE THE WHOLE SENTENCE. Do not guess, if you don\'t know the answer, return "idk".';

    return prompt;
  }
}

export default LlmGenerator;
