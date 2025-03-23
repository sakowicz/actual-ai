import type {
  TransactionEntity,
} from '@actual-app/api/@types/loot-core/types/models';
import SimilarityCalculator from './similarity-calculator';

class CategorySuggestionOptimizer {
  private readonly similarityCalculator: SimilarityCalculator;

  constructor(
    similarityCalculator: SimilarityCalculator,
  ) {
    this.similarityCalculator = similarityCalculator;
  }

  public optimizeCategorySuggestions(
    suggestedCategories: Map<string, {
            name: string;
            groupName: string;
            groupIsNew: boolean;
            groupId?: string;
            transactions: TransactionEntity[];
        }>,
  ): Map<string, {
        name: string;
        groupName: string;
        groupIsNew: boolean;
        groupId?: string;
        transactions: TransactionEntity[];
    }> {
    console.log('Optimizing category suggestions...');

    // Convert suggestions to array.
    const suggestions = Array.from(suggestedCategories.values());

    // Cluster suggestions across groups based on name similarity.
    const used = new Array(suggestions.length).fill(false);
    const clusters: { suggestions: typeof suggestions }[] = [];
    for (let i = 0; i < suggestions.length; i++) {
      if (used[i]) continue;
      const cluster = [suggestions[i]];
      used[i] = true;
      for (let j = i + 1; j < suggestions.length; j++) {
        if (used[j]) continue;
        // Dynamic threshold: shorter names need higher similarity.
        const minLength = Math.min(suggestions[i].name.length, suggestions[j].name.length);
        const baseThreshold = 0.7;
        const dynamicThreshold = baseThreshold + (1 / Math.max(5, minLength)) * 0.3;
        const sim = this.similarityCalculator.calculateNameSimilarity(
          suggestions[i].name,
          suggestions[j].name,
        );
        if (sim >= dynamicThreshold) {
          cluster.push(suggestions[j]);
          used[j] = true;
        }
      }
      clusters.push({ suggestions: cluster });
    }

    // Create optimized categories from clusters.
    const optimizedCategories = new Map<string, {
            name: string;
            groupName: string;
            groupIsNew: boolean;
            groupId?: string;
            transactions: TransactionEntity[];
            originalNames: string[];
        }>();
    clusters.forEach(({ suggestions: cluster }) => {
      // Merge transactions and original names.
      const mergedTransactions = cluster.flatMap((s) => s.transactions);
      const originalNames = cluster.map((s) => s.name);
      const bestName = this.chooseBestCategoryName(originalNames);
      // Choose representative group name from frequency.
      const groupCount = new Map<string, number>();
      cluster.forEach((s) => {
        const grp = s.groupName;
        groupCount.set(grp, (groupCount.get(grp) ?? 0) + 1);
      });
      let repGroup = cluster[0].groupName;
      let maxCount = 0;
      groupCount.forEach((cnt, grp) => {
        if (cnt > maxCount) {
          maxCount = cnt;
          repGroup = grp;
        }
      });
      // Determine groupIsNew: if any in cluster is new, mark true.
      const groupIsNew = cluster.some((s) => s.groupIsNew);
      optimizedCategories.set(`${repGroup}:${bestName}`, {
        name: bestName,
        groupName: repGroup,
        groupIsNew,
        groupId: undefined,
        transactions: mergedTransactions,
        originalNames,
      });
    });

    console.log(`Optimized from ${suggestions.length} to ${optimizedCategories.size} categories`);
    optimizedCategories.forEach((category) => {
      if (category.originalNames.length > 1) {
        console.log(`Merged categories ${category.originalNames.join(', ')} into "${category.name}"`);
      }
    });

    // Return map without originalNames.
    return new Map(
      Array.from(optimizedCategories.entries()).map(([key, value]) => [
        key,
        {
          name: value.name,
          groupName: value.groupName,
          groupIsNew: value.groupIsNew,
          groupId: value.groupId,
          transactions: value.transactions,
        },
      ]),
    );
  }

  private chooseBestCategoryName(names: string[]): string {
    if (names.length === 1) return names[0];

    // Count frequency of words across all names
    const wordFrequency = new Map<string, number>();
    const nameWords = names.map((name) => {
      const words = name.toLowerCase().split(/\s+/);
      words.forEach((word) => {
        wordFrequency.set(word, (wordFrequency.get(word) ?? 0) + 1);
      });
      return words;
    });

    // Score each name based on word frequency (more common words are better)
    const scores = names.map((name, i) => {
      const words = nameWords[i];
      const freqScore = words.reduce(
        (sum, word) => sum + wordFrequency.get(word)!,
        0,
      ) / words.length;

      // Prefer names that are in the sweet spot length (not too short, not too long)
      const lengthScore = 1 / (1 + Math.abs(words.length - 2));

      return { name, score: freqScore * 0.7 + lengthScore * 0.3 };
    });

    // Sort by score (descending) and return the best
    scores.sort((a, b) => b.score - a.score);
    return scores[0].name;
  }
}

export default CategorySuggestionOptimizer;
