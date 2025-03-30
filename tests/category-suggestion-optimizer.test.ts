import { TransactionEntity } from '@actual-app/api/@types/loot-core/types/models';
import SimilarityCalculator from '../src/similarity-calculator';
import CategorySuggestionOptimizer from '../src/category-suggestion-optimizer';
import GivenActualData from './test-doubles/given/given-actual-data';

describe('CategorySuggestionOptimizer', () => {
  let similarityCalculator: SimilarityCalculator;
  let optimizer: CategorySuggestionOptimizer;

  beforeEach(() => {
    similarityCalculator = new SimilarityCalculator();
    optimizer = new CategorySuggestionOptimizer(similarityCalculator);
  });

  describe('optimizeCategorySuggestions', () => {
    it('should not modify a map with a single category', () => {
      const transaction = GivenActualData.createTransaction('1', -1000, 'Test Transaction');
      const suggestedCategories = new Map<string, {
        name: string;
        groupName: string;
        groupIsNew: boolean;
        groupId?: string;
        transactions: TransactionEntity[];
      }>();

      suggestedCategories.set('Group:Category', {
        name: 'Category',
        groupName: 'Group',
        groupIsNew: true,
        transactions: [transaction],
      });

      const result = optimizer.optimizeCategorySuggestions(suggestedCategories);

      expect(result.size).toBe(1);
      expect(result.get('Group:Category')).toEqual({
        name: 'Category',
        groupName: 'Group',
        groupIsNew: true,
        transactions: [transaction],
      });
    });

    it('should merge similar categories across different groups', () => {
      const transaction1 = GivenActualData.createTransaction('1', -1000, 'Transaction 1');
      const transaction2 = GivenActualData.createTransaction('2', -2000, 'Transaction 2');

      const suggestedCategories = new Map<string, {
        name: string;
        groupName: string;
        groupIsNew: boolean;
        groupId?: string;
        transactions: TransactionEntity[];
      }>();

      suggestedCategories.set('Group1:Amazon', {
        name: 'Amazon',
        groupName: 'Group1',
        groupIsNew: true,
        transactions: [transaction1],
      });

      suggestedCategories.set('Group2:amazon.com', {
        name: 'amazon.com',
        groupName: 'Group2',
        groupIsNew: false,
        transactions: [transaction2],
      });

      jest.spyOn(similarityCalculator, 'calculateNameSimilarity').mockImplementation(
        (name1, name2) => {
          if ((name1 === 'Amazon' && name2 === 'amazon.com')
              || (name1 === 'amazon.com' && name2 === 'Amazon')) {
            return 0.9;
          }
          return 0.0;
        },
      );

      const result = optimizer.optimizeCategorySuggestions(suggestedCategories);

      // Should merge into one category
      expect(result.size).toBe(1);

      // The group with more categories wins (in this case, both have 1, so first group wins)
      const mergedKey = Array.from(result.keys())[0];
      const merged = result.get(mergedKey);

      expect(merged).toBeDefined();
      expect(merged?.groupIsNew).toBe(true); // true wins over false
      expect(merged?.transactions.length).toBe(2); // Transactions merged
    });

    it('should not merge categories with low similarity', () => {
      const transaction1 = GivenActualData.createTransaction('1', -1000, 'Transaction 1');
      const transaction2 = GivenActualData.createTransaction('2', -2000, 'Transaction 2');

      const suggestedCategories = new Map<string, {
        name: string;
        groupName: string;
        groupIsNew: boolean;
        groupId?: string;
        transactions: TransactionEntity[];
      }>();

      suggestedCategories.set('Group1:Groceries', {
        name: 'Groceries',
        groupName: 'Group1',
        groupIsNew: true,
        transactions: [transaction1],
      });

      suggestedCategories.set('Group2:Entertainment', {
        name: 'Entertainment',
        groupName: 'Group2',
        groupIsNew: false,
        transactions: [transaction2],
      });

      jest.spyOn(similarityCalculator, 'calculateNameSimilarity').mockReturnValue(0.2);

      const result = optimizer.optimizeCategorySuggestions(suggestedCategories);

      // Should not merge
      expect(result.size).toBe(2);
      expect(result.has('Group1:Groceries')).toBe(true);
      expect(result.has('Group2:Entertainment')).toBe(true);
    });

    it('should use the most frequent group name when merging', () => {
      const transaction1 = GivenActualData.createTransaction('1', -1000, 'Transaction 1');
      const transaction2 = GivenActualData.createTransaction('2', -2000, 'Transaction 2');
      const transaction3 = GivenActualData.createTransaction('3', -3000, 'Transaction 3');

      const suggestedCategories = new Map<string, {
        name: string;
        groupName: string;
        groupIsNew: boolean;
        groupId?: string;
        transactions: TransactionEntity[];
      }>();

      suggestedCategories.set('GroupA:Coffee', {
        name: 'Coffee',
        groupName: 'GroupA',
        groupIsNew: false,
        transactions: [transaction1],
      });

      suggestedCategories.set('GroupB:Coffee Shop', {
        name: 'Coffee Shop',
        groupName: 'GroupB',
        groupIsNew: false,
        transactions: [transaction2],
      });

      suggestedCategories.set('GroupB:Coffee Place', {
        name: 'Coffee Place',
        groupName: 'GroupB',
        groupIsNew: true,
        transactions: [transaction3],
      });

      jest.spyOn(similarityCalculator, 'calculateNameSimilarity').mockImplementation(
        (name1, name2) => {
          if (name1.toLowerCase().includes('coffee') && name2.toLowerCase().includes('coffee')) {
            return 0.85;
          }
          return 0.2;
        },
      );

      const result = optimizer.optimizeCategorySuggestions(suggestedCategories);

      // Should merge into one category
      expect(result.size).toBe(1);

      const mergedKey = Array.from(result.keys())[0];
      const merged = result.get(mergedKey);

      // GroupB should win as the most frequent
      expect(merged?.groupName).toBe('GroupB');
      expect(merged?.groupIsNew).toBe(true); // true wins over false
      expect(merged?.transactions.length).toBe(3); // All transactions merged
    });
  });

  test('should properly optimize category suggestions', () => {
    // Arrange
    const transaction: TransactionEntity = {
      id: 'txn1',
      date: '2023-01-01',
      account: 'account1',
      amount: -50,
      payee: 'payee1',
      imported_payee: 'Medical Visit',
      category: undefined,
      notes: '',
      cleared: true,
      reconciled: false,
      transfer_id: undefined,
      tombstone: false,
      schedule: undefined,
      sort_order: 0,
      starting_balance_flag: false,
      is_child: false,
      is_parent: false,
      parent_id: undefined,
      error: undefined,
    };

    const suggestedCategories = new Map<string, {
      name: string;
      groupName: string;
      groupIsNew: boolean;
      groupId?: string;
      transactions: TransactionEntity[];
    }>();

    suggestedCategories.set('Health & Medical:Medical Expenses', {
      name: 'Medical Expenses',
      groupName: 'Health & Medical',
      groupIsNew: true, // Expect groupId to be undefined after optimization for new groups
      transactions: [transaction],
    });

    // Act
    const optimizedCategories = optimizer.optimizeCategorySuggestions(
      suggestedCategories,
    );

    // Assert
    expect(optimizedCategories.size).toBe(1);
    const optimizedSuggestion = optimizedCategories.get('Health & Medical:Medical Expenses');
    expect(optimizedSuggestion).toBeDefined();
    expect(optimizedSuggestion?.name).toBe('Medical Expenses');
    expect(optimizedSuggestion?.groupName).toBe('Health & Medical');
    expect(optimizedSuggestion?.groupIsNew).toBe(true);
    // The optimizer should not assign a groupId for new groups.
    // The TransactionService is responsible for creating the group and getting the ID.
    expect(optimizedSuggestion?.groupId).toBeUndefined();
  });
});
