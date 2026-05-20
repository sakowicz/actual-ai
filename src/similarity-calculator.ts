import { PorterStemmer } from 'natural/lib/natural/stemmers';
import { JaroWinklerDistance } from 'natural/lib/natural/distance';

function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

class SimilarityCalculator {
  public calculateNameSimilarity(name1: string, name2: string): number {
    const a = normalize(name1);
    const b = normalize(name2);

    if (a === b) return 1.0;

    // tokenizeAndStem lowercases, drops English stopwords, and applies the
    // Porter stemmer so plurals ("sport"/"sports"), -ies ("category"/
    // "categories"), and -ation ("transport"/"transportation") collapse to
    // the same stem.
    const words1 = new Set(PorterStemmer.tokenizeAndStem(a));
    const words2 = new Set(PorterStemmer.tokenizeAndStem(b));

    const intersection = new Set([...words1].filter((x) => words2.has(x)));
    const union = new Set([...words1, ...words2]);
    const wordSimilarity = union.size === 0 ? 0 : intersection.size / union.size;

    // Subset boost: when one name's content words are fully contained in
    // the other's, the shorter name is likely a coarser version of the
    // same concept ("Travel" ⊆ "Travel & Transport"). Nudge the score so
    // these cluster together instead of bloating the category list.
    const smallerSize = Math.min(words1.size, words2.size);
    const isSubset = smallerSize > 0 && intersection.size === smallerSize;
    const subsetBoost = isSubset ? 0.15 : 0;

    const charSimilarity = JaroWinklerDistance(a, b);

    return Math.min(1.0, 0.6 * wordSimilarity + 0.4 * charSimilarity + subsetBoost);
  }
}

export default SimilarityCalculator;
