const LEGACY_NOTES_NOT_GUESSED = 'actual-ai could not guess this category';
const LEGACY_NOTES_GUESSED = 'actual-ai guessed this category';

class TagService {
  private readonly notGuessedTag: string;

  private readonly guessedTag: string;

  constructor(
    notGuessedTag: string,
    guessedTag: string,
  ) {
    this.notGuessedTag = notGuessedTag;
    this.guessedTag = guessedTag;
  }

  public addNotGuessedTag(notes: string): string {
    return this.appendTag(notes, this.notGuessedTag);
  }

  public addGuessedTag(notes: string): string {
    return this.appendTag(notes, this.guessedTag);
  }

  private appendTag(notes: string, tag: string): string {
    const clearedNotes = this.clearPreviousTags(notes);
    return `${clearedNotes} ${tag}`.trim();
  }

  public clearPreviousTags(notes: string): string {
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

  public isNotGuessed(notes: string): boolean {
    return notes.includes(this.notGuessedTag);
  }
}

export default TagService;
