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
        transactionId: 'tx-1',
        type: 'rule', categoryId: 'cat-1', ruleName: 'Coffee',
      })).toBe(true);
    });

    it('matches a rule response without categoryId (leave uncategorized)', () => {
      const { strategy } = buildStrategy();
      expect(strategy.isSatisfiedBy({ transactionId: 'tx-1', type: 'rule', ruleName: 'Skip Me' })).toBe(true);
    });

    it('rejects a rule response missing ruleName', () => {
      const { strategy } = buildStrategy();
      expect(strategy.isSatisfiedBy({ transactionId: 'tx-1', type: 'rule', categoryId: 'cat-1' } as any)).toBe(false);
    });

    it('rejects non-rule responses', () => {
      const { strategy } = buildStrategy();
      expect(strategy.isSatisfiedBy({
        transactionId: 'tx-1',
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
        transactionId: 'tx-1',
        type: 'rule', categoryId: 'cat-coffee', ruleName: 'Coffee',
      });

      const stored = (await apiService.getTransactions()).find((t) => t.id === 'tx-1');
      expect(stored?.category).toBe('cat-coffee');
      expect(stored?.notes).toContain('#actual-ai');
      expect(stored?.notes).toContain('(rule: Coffee)');
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
        transactionId: 'tx-2',
        type: 'rule', ruleName: 'Amazon leave uncategorized',
      });

      const stored = (await apiService.getTransactions()).find((t) => t.id === 'tx-2');
      expect(stored?.category).toBeUndefined();
      expect(stored?.notes).toContain('#actual-ai');
      expect(stored?.notes).toContain('(rule: Amazon leave uncategorized)');
    });
  });
});
