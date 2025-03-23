class SimilarityCalculator {
  public calculateNameSimilarity(name1: string, name2: string): number {
    // Normalize the strings for comparison
    const a = name1.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
    const b = name2.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();

    if (a === b) return 1.0;

    // Check for exact word matches
    const words1 = new Set(a.split(' '));
    const words2 = new Set(b.split(' '));

    // Calculate Jaccard similarity for words
    const intersection = new Set([...words1].filter((x) => words2.has(x)));
    const union = new Set([...words1, ...words2]);

    // Weight for word overlap
    const wordSimilarity = intersection.size / union.size;

    // Jaro-Winkler for character-level similarity
    const jaro = (s1: string, s2: string) => {
      const matchDistance = Math.floor(Math.max(s1.length, s2.length) / 2) - 1;
      const s1Matches = new Array<boolean>(s1.length).fill(false);
      const s2Matches = new Array<boolean>(s2.length).fill(false);

      let matches = 0;
      for (let i = 0; i < s1.length; i++) {
        const start = Math.max(0, i - matchDistance);
        const end = Math.min(i + matchDistance + 1, s2.length);
        for (let j = start; j < end; j++) {
          if (!s2Matches[j] && s1[i] === s2[j]) {
            s1Matches[i] = true;
            s2Matches[j] = true;
            matches++;
            break;
          }
        }
      }

      if (matches === 0) return 0;

      let transpositions = 0;
      let k = 0;
      for (let i = 0; i < s1.length; i++) {
        if (s1Matches[i]) {
          while (!s2Matches[k]) k++;
          if (s1[i] !== s2[k]) transpositions++;
          k++;
        }
      }

      return (
        matches / s1.length + matches / s2.length + (matches - transpositions / 2) / matches) / 3;
    };

    const charSimilarity = jaro(a, b);

    // Combine word-level and character-level similarity
    return 0.6 * wordSimilarity + 0.4 * charSimilarity;
  }
}

export default SimilarityCalculator;
