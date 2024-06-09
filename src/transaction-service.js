const { actualApi } = require('./actual-api');
const { askOpenai } = require('./openai');
const { syncAccountsBeforeClassify } = require('./config');
const { suppressConsoleLogsAsync } = require('./utils');

const NOTES_NOT_GUESSED = ' | OpenAI could not guess the category';
const NOTES_GUESSED = ' | OpenAI guessed the category';

function generatePrompt(categoryGroups, transaction, payees) {
  let prompt = 'Given I want to categorize the bank transactions in following categories:\n';
  categoryGroups.forEach((categoryGroup) => {
    categoryGroup.categories.forEach((category) => {
      prompt += `* ${category.name} (${categoryGroup.name}) (ID: "${category.id}") \n`;
    });
  });

  const payeeName = payees.find((payee) => payee.id === transaction.payee_id)?.name;

  prompt += 'Please categorize the following transaction: \n';
  prompt += `* Date: ${transaction.date}\n`;
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

function findUUIDInString(str) {
  const regex = /[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}/g;
  const matchResult = str.match(regex);
  return matchResult ? matchResult[0] : null;
}

async function syncAccounts() {
  console.log('Syncing bank accounts');
  try {
    await suppressConsoleLogsAsync(async () => await actualApi.runBankSync());
    console.log('Bank accounts synced');
  } catch (error) {
    console.error('Error syncing bank accounts:', error);
  }
}

async function processTransactions() {
  if (syncAccountsBeforeClassify) {
    await syncAccounts();
  }

  const categoryGroups = await actualApi.getCategoryGroups();
  const categories = await actualApi.getCategories();
  const payees = await actualApi.getPayees();
  const transactions = await actualApi.getTransactions();
  const uncategorizedTransactions = transactions.filter(
    (transaction) => !transaction.category
          && transaction.transfer_id === null
          && transaction.starting_balance_flag !== true
          && transaction.notes.includes(NOTES_NOT_GUESSED) === false,
  );

  for (let i = 0; i < uncategorizedTransactions.length; i++) {
    const transaction = uncategorizedTransactions[i];
    console.log(`${i + 1}/${uncategorizedTransactions.length} Processing transaction ${transaction.imported_payee} / ${transaction.notes} / ${transaction.amount}`);
    const prompt = generatePrompt(categoryGroups, transaction, payees);
    const guess = await askOpenai(prompt);
    const guessUUID = findUUIDInString(guess);
    const guessCategory = categories.find((category) => category.id === guessUUID);

    if (!guessCategory) {
      console.warn(`\`${i + 1}/${uncategorizedTransactions.length} OpenAI could not classify the transaction. OpenAIs guess: ${guess}`);
      await actualApi.updateTransaction(transaction.id, {
        notes: `${transaction.notes} ${NOTES_NOT_GUESSED}`,
      });
      continue;
    }
    console.log(`${i + 1}/${uncategorizedTransactions.length} Guess: ${guessCategory.name}`);
    transaction.notes = `${transaction.notes} ${NOTES_GUESSED}`;
    transaction.category_id = guessCategory.id;

    await actualApi.updateTransaction(transaction.id, {
      category: guessCategory.id,
      notes: `${transaction.notes} ${NOTES_GUESSED}`,
    });

    if (i >= 0) {
      break;
    }
  }
}
module.exports = {
  processTransactions,
};
