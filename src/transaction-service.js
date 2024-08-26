const { actualApi } = require('./actual-api');
const { ask } = require('./openai');
const { syncAccountsBeforeClassify } = require('./config');
const { suppressConsoleLogsAsync } = require('./utils');

const NOTES_NOT_GUESSED = 'actual-ai could not guess this category';
const NOTES_GUESSED = 'actual-ai guessed this category';

function findUUIDInString(str) {
  const regex = /[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}/g;
  const matchResult = str.match(regex);
  return matchResult ? matchResult[0] : null;
}

async function syncAccounts() {
  console.log('Syncing bank accounts');
  try {
    await suppressConsoleLogsAsync(async () => actualApi.runBankSync());
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
          && (transaction.notes === null || transaction.notes.includes(NOTES_NOT_GUESSED) === false),
  );

  for (let i = 0; i < uncategorizedTransactions.length; i++) {
    const transaction = uncategorizedTransactions[i];
    console.log(`${i + 1}/${uncategorizedTransactions.length} Processing transaction ${transaction.imported_payee} / ${transaction.notes} / ${transaction.amount}`);
    const guess = await ask(categoryGroups, transaction, payees);
    const guessUUID = findUUIDInString(guess);
    const guessCategory = categories.find((category) => category.id === guessUUID);

    if (!guessCategory) {
      console.warn(`${i + 1}/${uncategorizedTransactions.length} OpenAI could not classify the transaction. OpenAIs guess: ${guess}`);
      await actualApi.updateTransaction(transaction.id, {
        notes: `${transaction.notes} | ${NOTES_NOT_GUESSED}`,
      });
      continue;
    }
    console.log(`${i + 1}/${uncategorizedTransactions.length} Guess: ${guessCategory.name}`);

    await actualApi.updateTransaction(transaction.id, {
      category: guessCategory.id,
      notes: `${transaction.notes} | ${NOTES_GUESSED}`,
    });
  }
}
module.exports = {
  processTransactions,
};
