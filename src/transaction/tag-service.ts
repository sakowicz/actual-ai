const LEGACY_NOTES_NOT_GUESSED = 'actual-ai could not guess this category';
const LEGACY_NOTES_GUESSED = 'actual-ai guessed this category';

// A tag in a note runs up to the next whitespace or "#", as in Actual's own tags. Matching
// only whole tags keeps a note's tags that start with ours (such as "#airport" next to the
// tag "#ai") intact, and escaping lets a tag contain regex characters.
const escapeRegExp = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const wholeTag = (tag: string, flags = ''): RegExp => new RegExp(`\\s*${escapeRegExp(tag)}(?=[\\s#]|$)`, flags);

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
    // The "-miss" repair must run while the " #actual-ai" anchor still exists,
    // and the longer tag must be cleared before the shorter one: the default
    // guessedTag "#actual-ai" is a prefix of notGuessedTag "#actual-ai-miss",
    // so clearing it first ate the tag's head and glued one stray "-miss" onto
    // the note body per rerun ("…-miss-miss #actual-ai-miss").
    return notes
      .replace(/(-miss)+(?= #actual-ai)/g, '')
      .replace(wholeTag(this.notGuessedTag, 'g'), '')
      .replace(wholeTag(this.guessedTag, 'g'), '')
      .replace(new RegExp(`\\s*\\|\\s*${LEGACY_NOTES_NOT_GUESSED}`, 'g'), '')
      .replace(new RegExp(`\\s*\\|\\s*${LEGACY_NOTES_GUESSED}`, 'g'), '')
      .replace(new RegExp(`\\s*${LEGACY_NOTES_GUESSED}`, 'g'), '')
      .replace(new RegExp(`\\s*${LEGACY_NOTES_NOT_GUESSED}`, 'g'), '')
      .trim();
  }

  public isNotGuessed(notes: string): boolean {
    return wholeTag(this.notGuessedTag).test(notes);
  }
}

export default TagService;
