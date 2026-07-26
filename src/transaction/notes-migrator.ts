import type {
  ActualApiServiceI, NotesMigratorI,
} from '../types';
import TagService from './tag-service';

const LEGACY_NOTES_NOT_GUESSED = 'actual-ai could not guess this category';
const LEGACY_NOTES_GUESSED = 'actual-ai guessed this category';

class NotesMigrator implements NotesMigratorI {
  private readonly actualApiService: ActualApiServiceI;

  private readonly tagService: TagService;

  constructor(
    actualApiService: ActualApiServiceI,
    tagService: TagService,
  ) {
    this.actualApiService = actualApiService;
    this.tagService = tagService;
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

      const baseNotes = this.tagService.clearPreviousTags(transaction.notes ?? '');
      let newNotes = baseNotes;

      if (transaction.notes?.includes(LEGACY_NOTES_NOT_GUESSED)) {
        newNotes = this.tagService.addNotGuessedTag(baseNotes);
      } else if (transaction.notes?.includes(LEGACY_NOTES_GUESSED)) {
        newNotes = this.tagService.addGuessedTag(baseNotes);
      }

      if (newNotes !== transaction.notes) {
        await this.actualApiService.updateTransactionNotes(transaction.id, newNotes);
      }
    }
  }
}

export default NotesMigrator;
