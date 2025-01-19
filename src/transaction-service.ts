import {
  ActualApiServiceI, LlmServiceI, PromptGeneratorI, TransactionServiceI,
} from './types';

const LEGACY_NOTES_NOT_GUESSED = 'actual-ai could not guess this category';
const LEGACY_NOTES_GUESSED = 'actual-ai guessed this category';

class TransactionService implements TransactionServiceI {
  private readonly actualApiService: ActualApiServiceI;

  private readonly llmService: LlmServiceI;

  private readonly promptGenerator: PromptGeneratorI;

  private readonly notGuessedTag: string;

  private readonly guessedTag: string;

  constructor(
    actualApiClient: ActualApiServiceI,
    llmService: LlmServiceI,
    promptGenerator: PromptGeneratorI,
    notGuessedTag: string,
    guessedTag: string,
  ) {
    this.actualApiService = actualApiClient;
    this.llmService = llmService;
    this.promptGenerator = promptGenerator;
    this.notGuessedTag = notGuessedTag;
    this.guessedTag = guessedTag;
  }

  appendTag(notes: string, tag: string): string {
    const clearedNotes = this.clearPreviousTags(notes);
    return `${clearedNotes} ${tag}`.trim();
  }

  clearPreviousTags(notes: string): string {
    return notes.replace(new RegExp(` ${this.guessedTag}`, 'g'), '')
      .replace(new RegExp(` ${this.notGuessedTag}`, 'g'), '')
      .replace(new RegExp(` \\| ${LEGACY_NOTES_NOT_GUESSED}`, 'g'), '')
      .replace(new RegExp(` \\| ${LEGACY_NOTES_GUESSED}`, 'g'), '')
      .trim();
  }

  async migrateToTags(): Promise<void> {
    const transactions = await this.actualApiService.getTransactions();
    const transactionsToMigrate = transactions.filter(
      (transaction) => transaction.notes
        && (
          transaction.notes?.includes(LEGACY_NOTES_NOT_GUESSED)
          || transaction.notes?.includes(LEGACY_NOTES_GUESSED)
        ),
    );

    for (let i = 0; i < transactionsToMigrate.length; i++) {
      const transaction = transactionsToMigrate[i];
      console.log(`${i + 1}/${transactionsToMigrate.length} Migrating transaction ${transaction.imported_payee} / ${transaction.notes} / ${transaction.amount}`);

      let newNotes = null;
      if (transaction.notes?.includes(LEGACY_NOTES_NOT_GUESSED)) {
        newNotes = this.appendTag(transaction.notes, this.notGuessedTag);
      }
      if (transaction.notes?.includes(LEGACY_NOTES_GUESSED)) {
        newNotes = this.appendTag(transaction.notes, this.guessedTag);
      }

      if (newNotes) {
        await this.actualApiService.updateTransactionNotes(transaction.id, newNotes);
      }
    }
  }

  async processTransactions(): Promise<void> {
    const categoryGroups = await this.actualApiService.getCategoryGroups();
    const categories = await this.actualApiService.getCategories();
    const payees = await this.actualApiService.getPayees();
    const transactions = await this.actualApiService.getTransactions();

    const uncategorizedTransactions = transactions.filter(
      (transaction) => !transaction.category
        && (transaction.transfer_id === null || transaction.transfer_id === undefined)
        && transaction.starting_balance_flag !== true
        && transaction.imported_payee !== null
        && transaction.imported_payee !== ''
        && (transaction.notes === null || (!transaction.notes?.includes(this.notGuessedTag)))
        && !transaction.is_parent,
    );

    for (let i = 0; i < uncategorizedTransactions.length; i++) {
      const transaction = uncategorizedTransactions[i];
      console.log(`${i + 1}/${uncategorizedTransactions.length} Processing transaction ${transaction.imported_payee} / ${transaction.notes} / ${transaction.amount}`);
      const prompt = this.promptGenerator.generate(categoryGroups, transaction, payees);
      const categoryIds = categories.map((category) => category.id);
      categoryIds.push('uncategorized');
      const guess = await this.llmService.ask(prompt, categoryIds);
      const guessCategory = categories.find((category) => category.id === guess);

      if (!guessCategory) {
        console.warn(`${i + 1}/${uncategorizedTransactions.length} LLM could not classify the transaction. LLM guess: ${guess}`);
        await this.actualApiService.updateTransactionNotes(transaction.id, this.appendTag(transaction.notes ?? '', this.notGuessedTag));
        continue;
      }
      console.log(`${i + 1}/${uncategorizedTransactions.length} Guess: ${guessCategory.name}`);

      await this.actualApiService.updateTransactionNotesAndCategory(
        transaction.id,
        this.appendTag(transaction.notes ?? '', this.guessedTag),
        guessCategory.id,
      );
    }
  }
}

export default TransactionService;
