import SimilarityCalculator from '../src/similarity-calculator';

describe('SimilarityCalculator', () => {
  let calculator: SimilarityCalculator;

  beforeEach(() => {
    calculator = new SimilarityCalculator();
  });

  describe('calculateNameSimilarity', () => {
    it('should return 1.0 for identical strings', () => {
      const result = calculator.calculateNameSimilarity('Test String', 'Test String');
      expect(result).toBe(1.0);
    });

    it('should return 1.0 for identical strings with different case', () => {
      const result = calculator.calculateNameSimilarity('test string', 'TEST STRING');
      expect(result).toBe(1.0);
    });

    it('should return 1.0 for identical strings with different spacing', () => {
      const result = calculator.calculateNameSimilarity('test  string', 'test string');
      expect(result).toBe(1.0);
    });

    it('should return 1.0 for identical strings with different special characters', () => {
      const result = calculator.calculateNameSimilarity('test-string', 'test string');
      expect(result).toBe(1.0);
    });

    it('should return medium to high similarity for similar strings', () => {
      const result = calculator.calculateNameSimilarity('Amazon', 'Amazon.com');
      expect(result).toBeGreaterThan(0.6);
    });

    it('should return high similarity for strings with common words', () => {
      const result = calculator.calculateNameSimilarity('Coffee Shop Downtown', 'Downtown Coffee');
      expect(result).toBeGreaterThan(0.6);
    });

    it('should return lower similarity for different strings', () => {
      const result = calculator.calculateNameSimilarity('Grocery Store', 'Electronics Shop');
      expect(result).toBeLessThan(0.5);
    });

    it('should handle strings with numbers', () => {
      const result = calculator.calculateNameSimilarity('Store 123', 'Store 123');
      expect(result).toBe(1.0);
    });

    it('should handle edge cases with empty strings', () => {
      const result = calculator.calculateNameSimilarity('', '');
      expect(result).toBe(1.0);
    });

    it('should handle edge cases with one empty string', () => {
      const result = calculator.calculateNameSimilarity('Something', '');
      expect(result).toBeLessThan(0.2);
    });
  });
});
