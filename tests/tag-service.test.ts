import TagService from '../src/transaction/tag-service';

describe('TagService', () => {
  const service = new TagService('#actual-ai-miss', '#actual-ai');

  describe('addNotGuessedTag', () => {
    it('tags an untagged note', () => {
      expect(service.addNotGuessedTag('some note')).toBe('some note #actual-ai-miss');
    });

    it('is idempotent on an already-tagged note (regression: "-miss" grew per rerun)', () => {
      const once = service.addNotGuessedTag('some note');
      expect(service.addNotGuessedTag(once)).toBe(once);
    });

    it('heals "-miss" chains left by the prefix-eating bug', () => {
      expect(service.addNotGuessedTag('some note-miss-miss #actual-ai-miss'))
        .toBe('some note #actual-ai-miss');
    });
  });

  describe('addGuessedTag', () => {
    it('replaces the miss tag without leaving a stray "-miss" on the note body', () => {
      expect(service.addGuessedTag('some note #actual-ai-miss')).toBe('some note #actual-ai');
    });

    it('is idempotent on an already-guessed note', () => {
      const once = service.addGuessedTag('some note');
      expect(service.addGuessedTag(once)).toBe(once);
    });
  });

  describe('clearPreviousTags', () => {
    it('removes both tags and healed "-miss" chains', () => {
      expect(service.clearPreviousTags('some note-miss #actual-ai-miss')).toBe('some note');
      expect(service.clearPreviousTags('some note #actual-ai')).toBe('some note');
    });

    it('keeps unrelated note content untouched', () => {
      const note = '[enrich:gocardless] eBay O*05-13940-83058 (Σ -42.73 EUR)';
      expect(service.clearPreviousTags(`${note} #actual-ai-miss`)).toBe(note);
    });
  });

  describe('with short custom tags', () => {
    const custom = new TagService('#ai-miss', '#ai');

    it('leaves the note\'s own tags that start with a tag alone', () => {
      expect(custom.addGuessedTag('Trip #airport')).toBe('Trip #airport #ai');
      expect(custom.clearPreviousTags('Trip #airport #ai-miss')).toBe('Trip #airport');
    });

    it('treats only the whole not-guessed tag as not guessed', () => {
      expect(custom.isNotGuessed('Lunch #ai-missing-receipt')).toBe(false);
      expect(custom.isNotGuessed('Lunch #ai-miss')).toBe(true);
    });

    it('matches tags with regex characters literally', () => {
      const paren = new TagService('#ai(miss)', '#ai(ok)');
      expect(paren.addNotGuessedTag('note #ai(miss)')).toBe('note #ai(miss)');
    });
  });
});
