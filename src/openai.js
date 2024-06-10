const OpenAI = require('openai');
const { model } = require('./config');

const openai = new OpenAI({});

function generatePrompt(categoryGroups, transaction, payees) {
  let prompt = 'Given I want to categorize the bank transactions in following categories:\n';
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

  prompt += 'ANSWER BY A CATEGORY ID.DO NOT WRITE THE WHOLE SENTENCE. Do not guess, if you don\'t know answer: "idk".';

  return prompt;
}

async function callOpenAI(prompt) {
  const response = await openai.completions.create({
    model,
    prompt,
    temperature: 0.1,
    max_tokens: 50,
  });

  let guess = response.choices[0].text;
  guess = guess.replace(/(\r\n|\n|\r)/gm, '');

  return guess;
}

async function ask(categoryGroups, transaction, payees) {
  const prompt = generatePrompt(categoryGroups, transaction, payees);

  return callOpenAI(prompt);
}

module.exports = {
  ask,
};
