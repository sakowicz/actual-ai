import type {
  ActualApiServiceI, NotesMigratorI,
} from '../types';

const LEGACY_NOTES_NOT_GUESSED = 'actual-ai could not guess this category';
const LEGACY_NOTES_GUESSED = 'actual-ai guessed this category';

class NotesMigrator implements NotesMigratorI {
  private readonly actualApiService: ActualApiServiceI;

  private readonly notGuessedTag: string;

  private readonly guessedTag: string;

  constructor(
    actualApiClient: ActualApiServiceI,
    notGuessedTag: string,
    guessedTag: string,
  ) {
    this.actualApiService = actualApiClient;
    this.notGuessedTag = notGuessedTag;
    this.guessedTag = guessedTag;
  }

  appendTag(notes: string, tag: string): string {
    const clearedNotes = this.clearPreviousTags(notes);
    return `${clearedNotes} ${tag}`.trim();
  }

  clearPreviousTags(notes: string): string {
    return notes
      .replace(new RegExp(`\\s*${this.guessedTag}`, 'g'), '')
      .replace(new RegExp(`\\s*${this.notGuessedTag}`, 'g'), '')
      .replace(new RegExp(`\\s*\\|\\s*${LEGACY_NOTES_NOT_GUESSED}`, 'g'), '')
      .replace(new RegExp(`\\s*\\|\\s*${LEGACY_NOTES_GUESSED}`, 'g'), '')
      .replace(new RegExp(`\\s*${LEGACY_NOTES_GUESSED}`, 'g'), '')
      .replace(new RegExp(`\\s*${LEGACY_NOTES_NOT_GUESSED}`, 'g'), '')
      .replace(/-miss(?= #actual-ai)/g, '')
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

      const baseNotes = this.clearPreviousTags(transaction.notes ?? '');
      let newNotes = baseNotes;

      if (transaction.notes?.includes(LEGACY_NOTES_NOT_GUESSED)) {
        newNotes = this.appendTag(baseNotes, this.notGuessedTag);
      } else if (transaction.notes?.includes(LEGACY_NOTES_GUESSED)) {
        newNotes = this.appendTag(baseNotes, this.guessedTag);
      }

      if (newNotes !== transaction.notes) {
        await this.actualApiService.updateTransactionNotes(transaction.id, newNotes);
      }
    }
  }
}

export default NotesMigrator;
