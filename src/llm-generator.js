const { generateText } = require('ai');
const { create: createModel } = require('./llm-model-factory');

async function generatePrompt(categoryGroups, transaction, payees) {
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

async function callModel(model, prompt) {
  const { text } = await generateText({
    model,
    prompt,
    temperature: 0.1,
    max_tokens: 50,
  });

  return text.replace(/(\r\n|\n|\r|"|')/gm, '');
}

async function ask(categoryGroups, transaction, payees) {
  const prompt = await generatePrompt(categoryGroups, transaction, payees);
  const model = createModel();

  return callModel(model, prompt);
}

module.exports = {
  ask,
};
