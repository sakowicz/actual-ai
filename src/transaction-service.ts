import suppressConsoleLogsAsync from './utils';
import {
  ActualApiServiceI, LlmServiceI, PromptGeneratorI, TransactionServiceI,
} from './types';

const NOTES_NOT_GUESSED = 'actual-ai could not guess this category';
const NOTES_GUESSED = 'actual-ai guessed this category';

class TransactionService implements TransactionServiceI {
  private readonly actualAiService: ActualApiServiceI;

  private readonly llmService: LlmServiceI;

  private readonly promptGenerator: PromptGeneratorI;

  private readonly syncAccountsBeforeClassify: boolean;

  constructor(
    actualApiClient: ActualApiServiceI,
    llmService: LlmServiceI,
    promptGenerator: PromptGeneratorI,
    syncAccountsBeforeClassify: boolean,
  ) {
    this.actualAiService = actualApiClient;
    this.llmService = llmService;
    this.promptGenerator = promptGenerator;
    this.syncAccountsBeforeClassify = syncAccountsBeforeClassify;
  }

  static findUUIDInString(str: string): string | null {
    const regex = /[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}/g;
    const matchResult = str.match(regex);
    return matchResult ? matchResult[0] : null;
  }

  async syncAccounts(): Promise<void> {
    console.log('Syncing bank accounts');
    try {
      await suppressConsoleLogsAsync(async () => this.actualAiService.runBankSync());
      console.log('Bank accounts synced');
    } catch (error) {
      console.error('Error syncing bank accounts:', error);
    }
  }

  async processTransactions(): Promise<void> {
    if (this.syncAccountsBeforeClassify) {
      await this.syncAccounts();
    }

    const categoryGroups = await this.actualAiService.getCategoryGroups();
    const categories = await this.actualAiService.getCategories();
    const payees = await this.actualAiService.getPayees();
    const transactions = await this.actualAiService.getTransactions();
    const uncategorizedTransactions = transactions.filter(
      (transaction) => !transaction.category
        && (transaction.transfer_id === null || transaction.transfer_id === undefined)
        && transaction.starting_balance_flag !== true
        && transaction.imported_payee !== null
        && transaction.imported_payee !== ''
        && (transaction.notes === null || (!transaction.notes?.includes(NOTES_NOT_GUESSED)))
        && !transaction.is_parent,
    );

    for (let i = 0; i < uncategorizedTransactions.length; i++) {
      const transaction = uncategorizedTransactions[i];
      console.log(`${i + 1}/${uncategorizedTransactions.length} Processing transaction ${transaction.imported_payee} / ${transaction.notes} / ${transaction.amount}`);
      const prompt = this.promptGenerator.generate(categoryGroups, transaction, payees);
      const guess = await this.llmService.ask(prompt);
      const guessUUID = TransactionService.findUUIDInString(guess);
      const guessCategory = categories.find((category) => category.id === guessUUID);

      if (!guessCategory) {
        console.warn(`${i + 1}/${uncategorizedTransactions.length} LLM could not classify the transaction. LLM guess: ${guess}`);
        await this.actualAiService.updateTransactionNotes(transaction.id, `${transaction.notes} | ${NOTES_NOT_GUESSED}`);
        continue;
      }
      console.log(`${i + 1}/${uncategorizedTransactions.length} Guess: ${guessCategory.name}`);

      await this.actualAiService.updateTransactionNotesAndCategory(
        transaction.id,
        `${transaction.notes} | ${NOTES_GUESSED}`,
        guessCategory.id,
      );
    }
  }
}

export default TransactionService;
