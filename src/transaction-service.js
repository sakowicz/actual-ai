const { syncAccountsBeforeClassify } = require('./config');
const { suppressConsoleLogsAsync } = require('./utils');
const { LlmGenerator } = require('./llm-generator');

const NOTES_NOT_GUESSED = 'actual-ai could not guess this category';
const NOTES_GUESSED = 'actual-ai guessed this category';

class TransactionService {
  constructor({
    actualApi, llmModelFactory, ai,
  }) {
    this.actualApi = actualApi;
    this.ai = ai;
    this.model = llmModelFactory.create();
  }

  static findUUIDInString(str) {
    const regex = /[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}/g;
    const matchResult = str.match(regex);
    return matchResult ? matchResult[0] : null;
  }

  async syncAccounts() {
    console.log('Syncing bank accounts');
    try {
      await suppressConsoleLogsAsync(async () => this.actualApi.runBankSync());
      console.log('Bank accounts synced');
    } catch (error) {
      console.error('Error syncing bank accounts:', error);
    }
  }

  async processTransactions() {
    if (syncAccountsBeforeClassify) {
      await this.syncAccounts();
    }

    const categoryGroups = await this.actualApi.getCategoryGroups();
    const categories = await this.actualApi.getCategories();
    const payees = await this.actualApi.getPayees();
    const transactions = await this.actualApi.getTransactions();
    const uncategorizedTransactions = transactions.filter(
      (transaction) => !transaction.category
            && transaction.transfer_id === null
            && transaction.starting_balance_flag !== true
            && transaction.imported_payee !== null
            && transaction.imported_payee !== ''
            && (transaction.notes === null
                || (transaction.notes !== null && !transaction.notes.includes(NOTES_NOT_GUESSED))),
    );

    for (let i = 0; i < uncategorizedTransactions.length; i++) {
      const transaction = uncategorizedTransactions[i];
      console.log(`${i + 1}/${uncategorizedTransactions.length} Processing transaction ${transaction.imported_payee} / ${transaction.notes} / ${transaction.amount}`);
      const guess = await this.ask(categoryGroups, transaction, payees);
      const guessUUID = TransactionService.findUUIDInString(guess);
      const guessCategory = categories.find((category) => category.id === guessUUID);

      if (!guessCategory) {
        console.warn(`${i + 1}/${uncategorizedTransactions.length} LLM could not classify the transaction. LLM guess: ${guess}`);
        await this.actualApi.updateTransaction(transaction.id, {
          notes: `${transaction.notes} | ${NOTES_NOT_GUESSED}`,
        });
        continue;
      }
      console.log(`${i + 1}/${uncategorizedTransactions.length} Guess: ${guessCategory.name}`);

      await this.actualApi.updateTransaction(transaction.id, {
        category: guessCategory.id,
        notes: `${transaction.notes} | ${NOTES_GUESSED}`,
      });
    }
  }

  async ask(categoryGroups, transaction, payees) {
    const prompt = await LlmGenerator.generatePrompt(categoryGroups, transaction, payees);

    return this.callModel(this.model, prompt);
  }

  async callModel(model, prompt) {
    const { text } = await this.ai.generateText({
      model,
      prompt,
      temperature: 0.1,
      max_tokens: 50,
    });

    return text.replace(/(\r\n|\n|\r|"|')/gm, '');
  }
}

exports.TransactionService = TransactionService;
