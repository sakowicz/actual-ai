interface Category {
  id: string;
  name: string;
}

interface CategoryGroup {
  name: string;
  categories: Category[];
}

interface Transaction {
  amount: number;
  notes: string;
  payee_id: string;
  imported_payee: string;
}

interface Payee {
  id: string;
  name: string;
}

class LlmGenerator {
  static async generatePrompt(
    categoryGroups: CategoryGroup[],
    transaction: Transaction,
    payees: Payee[],
  ): Promise<string> {
    let prompt = 'I want to categorize the given bank transactions into the following categories:\n';
    categoryGroups.forEach((categoryGroup) => {
      categoryGroup.categories.forEach((category) => {
        prompt += `* ${category.name} (${categoryGroup.name}) (ID: "${category.id}") \n`;
      });
    });

    const payeeName = payees.find((payee) => payee.id === transaction.payee_id)?.name;

    prompt += 'Please categorize the following transaction: \n';
    prompt += `* Amount: ${Math.abs(transaction.amount)}\n`;
    prompt += `* Type: ${transaction.amount > 0 ? 'Income' : 'Outcome'}\n`;
    prompt += `* Description: ${transaction.notes}\n`;
    if (payeeName) {
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
