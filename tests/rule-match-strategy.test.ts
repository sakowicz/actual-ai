import RuleMatchStrategy from '../src/transaction/processing-strategy/rule-match-strategy';
import TagService from '../src/transaction/tag-service';
import InMemoryActualApiService from './test-doubles/in-memory-actual-api-service';
import GivenActualData from './test-doubles/given/given-actual-data';

const buildStrategy = () => {
  const apiService = new InMemoryActualApiService();
  const tagService = new TagService('#actual-ai-miss', '#actual-ai');
  const strategy = new RuleMatchStrategy(apiService, tagService);
  return { strategy, apiService };
};

describe('RuleMatchStrategy', () => {
  describe('isSatisfiedBy', () => {
    it('matches a rule response with categoryId', () => {
      const { strategy } = buildStrategy();
      expect(strategy.isSatisfiedBy({
        type: 'rule', categoryId: 'cat-1', ruleName: 'Coffee',
      })).toBe(true);
    });

    it('matches a rule response without categoryId (leave uncategorized)', () => {
      const { strategy } = buildStrategy();
      expect(strategy.isSatisfiedBy({ type: 'rule', ruleName: 'Skip Me' })).toBe(true);
    });

    it('rejects a rule response missing ruleName', () => {
      const { strategy } = buildStrategy();
      expect(strategy.isSatisfiedBy({ type: 'rule', categoryId: 'cat-1' })).toBe(false);
    });

    it('rejects non-rule responses', () => {
      const { strategy } = buildStrategy();
      expect(strategy.isSatisfiedBy({
        type: 'existing', categoryId: 'cat-1',
      })).toBe(false);
    });
  });

  describe('process', () => {
    it('updates notes and category when categoryId is present', async () => {
      const { strategy, apiService } = buildStrategy();
      const transaction = GivenActualData.createTransaction('tx-1', -100, 'Coffee', '');
      apiService.setTransactions([transaction]);

      await strategy.process(transaction, {
        type: 'rule', categoryId: 'cat-coffee', ruleName: 'Coffee',
      }, [GivenActualData.createCategory('cat-coffee', 'Coffee', '1')]);

      const stored = (await apiService.getTransactions()).find((t) => t.id === 'tx-1');
      expect(stored?.category).toBe('cat-coffee');
      expect(stored?.notes).toContain('#actual-ai');
      expect(stored?.notes).toContain('(rule: Coffee)');
    });

    it('tags the transaction as missed when the category id is not in the budget', async () => {
      const { strategy, apiService } = buildStrategy();
      const transaction = GivenActualData.createTransaction('tx-3', -100, 'Apple', 'original notes');
      apiService.setTransactions([transaction]);

      await strategy.process(transaction, {
        type: 'rule', categoryId: 'cat-made-up', ruleName: 'Coffee',
      }, [GivenActualData.createCategory('cat-coffee', 'Coffee', '1')]);

      const stored = (await apiService.getTransactions()).find((t) => t.id === 'tx-3');
      expect(stored?.category).toBeUndefined();
      expect(stored?.notes).toContain('#actual-ai-miss');
      expect(stored?.notes).not.toContain('(rule:');
    });

    it('only tags notes when the rule says leave uncategorized', async () => {
      const { strategy, apiService } = buildStrategy();
      const transaction = GivenActualData.createTransaction(
        'tx-2',
        -100,
        'Amazon',
        'original notes',
      );
      apiService.setTransactions([transaction]);

      await strategy.process(transaction, {
        type: 'rule', ruleName: 'Amazon leave uncategorized',
      }, []);

      const stored = (await apiService.getTransactions()).find((t) => t.id === 'tx-2');
      expect(stored?.category).toBeUndefined();
      expect(stored?.notes).toContain('#actual-ai');
      expect(stored?.notes).toContain('(rule: Amazon leave uncategorized)');
    });
  });
});
