import TransactionFilterer from '../src/transaction/transaction-filterer';
import TagService from '../src/transaction/tag-service';
import GivenActualData from './test-doubles/given/given-actual-data';
import * as config from '../src/config';

describe('TransactionFilterer Amazon Noter Workflow', () => {
  let sut: TransactionFilterer;
  const tagService = new TagService('#actual-ai', '#actual-ai-miss');

  beforeEach(() => {
    sut = new TransactionFilterer(tagService);
    config.toggleFeature('amazonNoterWorkflow', false);
  });

  describe('when amazonNoterWorkflow feature is disabled', () => {
    it('should NOT filter out Amazon transactions', () => {
      // Arrange
      const accounts = GivenActualData.createSampleAccounts();
      const categories = GivenActualData.createSampleCategories();
      const payees = [
        GivenActualData.createPayee('1', 'Amazon Payee'),
        GivenActualData.createPayee('2', 'Normal Payee'),
      ];

      const transactions = [
        GivenActualData.createTransaction('tx1', -500, 'AMZN MKTP', '', '1'),
        GivenActualData.createTransaction('tx2', -200, 'Normal Store', '', '2'),
      ];

      // Act
      const result = sut.filterUncategorized(transactions, accounts, categories, payees);

      // Assert
      expect(result).toHaveLength(2);
      expect(result.map((tx) => tx.id)).toContain('tx1');
      expect(result.map((tx) => tx.id)).toContain('tx2');
    });
  });

  describe('when amazonNoterWorkflow feature is enabled', () => {
    beforeEach(() => {
      config.toggleFeature('amazonNoterWorkflow', true);
    });

    it('should filter out Amazon transactions by imported_payee', () => {
      // Arrange
      const accounts = GivenActualData.createSampleAccounts();
      const categories = GivenActualData.createSampleCategories();
      const payees = [
        GivenActualData.createPayee('1', 'Normal Store'),
      ];

      const transactions = [
        GivenActualData.createTransaction('tx1', -500, 'AMZN MKTP', '', '1'),
        GivenActualData.createTransaction('tx2', -200, 'Normal Store', '', '1'),
      ];

      // Act
      const result = sut.filterUncategorized(transactions, accounts, categories, payees);

      // Assert
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('tx2');
    });

    it('should filter out Amazon transactions by resolved payee name', () => {
      // Arrange
      const accounts = GivenActualData.createSampleAccounts();
      const categories = GivenActualData.createSampleCategories();
      const payees = [
        GivenActualData.createPayee('1', 'Amazon EU'),
        GivenActualData.createPayee('2', 'Normal Store'),
      ];

      const transactions = [
        GivenActualData.createTransaction('tx1', -500, 'Standard Store', '', '1'),
        GivenActualData.createTransaction('tx2', -200, 'Normal Store', '', '2'),
      ];

      // Act
      const result = sut.filterUncategorized(transactions, accounts, categories, payees);

      // Assert
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('tx2');
    });

    it('should filter out Amazon transactions by note content', () => {
      // Arrange
      const accounts = GivenActualData.createSampleAccounts();
      const categories = GivenActualData.createSampleCategories();
      const payees = [
        GivenActualData.createPayee('1', 'Normal Store'),
      ];

      const transactions = [
        GivenActualData.createTransaction('tx1', -500, 'Normal Store', 'Order from amazon.co.uk', '1'),
        GivenActualData.createTransaction('tx2', -200, 'Normal Store', 'Some other notes', '1'),
      ];

      // Act
      const result = sut.filterUncategorized(transactions, accounts, categories, payees);

      // Assert
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('tx2');
    });

    it('should filter out split child transaction if parent mentions Amazon', () => {
      // Arrange
      const accounts = GivenActualData.createSampleAccounts();
      const categories = GivenActualData.createSampleCategories();
      const payees = [
        GivenActualData.createPayee('1', 'Amazon Marketplace'),
        GivenActualData.createPayee('2', 'Normal Store'),
      ];

      // Parent transaction (should be skipped because it is parent)
      const parentTx = GivenActualData.createTransaction('parent', -1000, 'AMZN Marketplace', '', '1');
      parentTx.is_parent = true;

      // Child transaction (split)
      const childTx = GivenActualData.createTransaction('child', -1000, '', 'Supa Dried Mealworms', '2');
      childTx.parent_id = 'parent';

      const transactions = [parentTx, childTx];

      // Act
      const result = sut.filterUncategorized(transactions, accounts, categories, payees);

      // Assert
      // Parent is skipped because is_parent: true, child is skipped because parent mentions Amazon
      expect(result).toHaveLength(0);
    });

    it('should NOT filter out positive income/refund transactions if they have uploader notes, even if includeIncome is disabled', () => {
      // Arrange
      config.toggleFeature('includeIncome', false);
      const accounts = GivenActualData.createSampleAccounts();
      const categories = GivenActualData.createSampleCategories();
      const payees = [
        GivenActualData.createPayee('1', 'Amazon Marketplace'),
      ];

      const transactions = [
        // Refund with uploader notes (positive amount)
        GivenActualData.createTransaction('tx_refund', 1500, 'AMZN Marketplace', '#Amazon-Product-Name Wireless Mouse #Amazon-Order-ID 123-456', '1'),
        // Standard non-Amazon refund (positive amount) - should be filtered out
        GivenActualData.createTransaction('tx_other_refund', 2000, 'Some Other Shop', '', '2'),
      ];

      // Act
      const result = sut.filterUncategorized(transactions, accounts, categories, payees);

      // Assert
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('tx_refund');
    });

    it('should filter out positive income/refund transactions if they do NOT have uploader notes and includeIncome is disabled', () => {
      // Arrange
      config.toggleFeature('includeIncome', false);
      const accounts = GivenActualData.createSampleAccounts();
      const categories = GivenActualData.createSampleCategories();
      const payees = [
        GivenActualData.createPayee('1', 'Amazon Marketplace'),
      ];

      const transactions = [
        // Refund WITHOUT uploader notes (positive amount)
        GivenActualData.createTransaction('tx_raw_refund', 1500, 'AMZN Marketplace', '', '1'),
      ];

      // Act
      const result = sut.filterUncategorized(transactions, accounts, categories, payees);

      // Assert
      expect(result).toHaveLength(0);
    });
  });
});
