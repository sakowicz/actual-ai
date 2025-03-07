import type {
  CategoryEntity,
  TransactionEntity,
} from '@actual-app/api/@types/loot-core/types/models';
import type {
  ActualApiServiceI,
  LlmServiceI,
  PromptGeneratorI,
  TransactionServiceI,
  CategorySuggestion,
} from './types';

const LEGACY_NOTES_NOT_GUESSED = 'actual-ai could not guess this category';
const LEGACY_NOTES_GUESSED = 'actual-ai guessed this category';
const BATCH_SIZE = 20; // Process transactions in batches of 20

class TransactionService implements TransactionServiceI {
  private readonly actualApiService: ActualApiServiceI;

  private readonly llmService: LlmServiceI;

  private readonly promptGenerator: PromptGeneratorI;

  private readonly notGuessedTag: string;

  private readonly guessedTag: string;

  private readonly suggestNewCategories: boolean;

  private readonly dryRun: boolean;

  constructor(
    actualApiClient: ActualApiServiceI,
    llmService: LlmServiceI,
    promptGenerator: PromptGeneratorI,
    notGuessedTag: string,
    guessedTag: string,
    suggestNewCategories = false,
    dryRun = true,
  ) {
    this.actualApiService = actualApiClient;
    this.llmService = llmService;
    this.promptGenerator = promptGenerator;
    this.notGuessedTag = notGuessedTag;
    this.guessedTag = guessedTag;
    this.suggestNewCategories = suggestNewCategories;
    this.dryRun = dryRun;
  }

  appendTag(notes: string, tag: string): string {
    const clearedNotes = this.clearPreviousTags(notes);
    return `${clearedNotes} ${tag}`.trim();
  }

  clearPreviousTags(notes: string): string {
    return notes.replace(new RegExp(` ${this.guessedTag}`, 'g'), '')
      .replace(new RegExp(` ${this.notGuessedTag}`, 'g'), '')
      .replace(new RegExp(` \\| ${LEGACY_NOTES_NOT_GUESSED}`, 'g'), '')
      .replace(new RegExp(` \\| ${LEGACY_NOTES_GUESSED}`, 'g'), '')
      .trim();
  }

  async migrateToTags(): Promise<void> {
    const transactions = await this.actualApiService.getTransactions();
    const transactionsToMigrate = transactions.filter(
      (transaction) => transaction.notes
        && (
          transaction.notes?.includes(LEGACY_NOTES_NOT_GUESSED)
          || transaction.notes?.includes(LEGACY_NOTES_GUESSED)
        ),
    );

    for (let i = 0; i < transactionsToMigrate.length; i++) {
      const transaction = transactionsToMigrate[i];
      console.log(`${i + 1}/${transactionsToMigrate.length} Migrating transaction ${transaction.imported_payee} / ${transaction.notes} / ${transaction.amount}`);

      let newNotes = null;
      if (transaction.notes?.includes(LEGACY_NOTES_NOT_GUESSED)) {
        newNotes = this.appendTag(transaction.notes, this.notGuessedTag);
      }
      if (transaction.notes?.includes(LEGACY_NOTES_GUESSED)) {
        newNotes = this.appendTag(transaction.notes, this.guessedTag);
      }

      if (newNotes) {
        await this.actualApiService.updateTransactionNotes(transaction.id, newNotes);
      }
    }
  }

  async processTransactions(): Promise<void> {
    if (this.dryRun) {
      console.log('=== DRY RUN MODE ===');
      console.log('No changes will be made to transactions or categories');
      console.log('=====================');
    }

    const [categoryGroups, categories, payees, transactions, accounts, rules] = await Promise.all([
      this.actualApiService.getCategoryGroups(),
      this.actualApiService.getCategories(),
      this.actualApiService.getPayees(),
      this.actualApiService.getTransactions(),
      this.actualApiService.getAccounts(),
      this.actualApiService.getRules(),
    ]);
    const accountsToSkip = accounts?.filter((account) => account.offbudget)
      .map((account) => account.id) ?? [];
    console.log(`Found ${rules.length} transaction categorization rules`);

    const uncategorizedTransactions = transactions.filter(
      (transaction) => !transaction.category
        && (transaction.transfer_id === null || transaction.transfer_id === undefined)
        && transaction.starting_balance_flag !== true
        && transaction.imported_payee !== null
        && transaction.imported_payee !== ''
        // && !transaction.notes?.includes(this.notGuessedTag)
        && !transaction.is_parent
        && !accountsToSkip.includes(transaction.account),
    );

    if (uncategorizedTransactions.length === 0) {
      console.log('No uncategorized transactions to process');
      return;
    }

    console.log(`Found ${uncategorizedTransactions.length} uncategorized transactions`);

    // Track suggested new categories
    const suggestedCategories = new Map<string, {
      name: string;
      groupName: string;
      groupIsNew: boolean;
      groupId?: string;
      transactions: TransactionEntity[];
    }>();

    // Process transactions in batches
    for (
      let batchStart = 0;
      batchStart < uncategorizedTransactions.length;
      batchStart += BATCH_SIZE
    ) {
      const batchEnd = Math.min(batchStart + BATCH_SIZE, uncategorizedTransactions.length);
      console.log(`Processing batch ${batchStart / BATCH_SIZE + 1} (transactions ${batchStart + 1}-${batchEnd})`);

      const batch = uncategorizedTransactions.slice(batchStart, batchEnd);

      await batch.reduce(async (previousPromise, transaction, batchIndex) => {
        await previousPromise;
        const globalIndex = batchStart + batchIndex;
        console.log(
          `${globalIndex + 1}/${uncategorizedTransactions.length} Processing transaction '${transaction.imported_payee}'`,
        );

        try {
          const prompt = this.promptGenerator.generateUnifiedPrompt(
            categoryGroups,
            transaction,
            payees,
            rules,
          );

          const response = await this.llmService.unifiedAsk(prompt);

          if (response.type === 'rule' && response.ruleName && response.categoryId) {
            await this.handleRuleMatch(transaction, {
              ruleName: response.ruleName,
              categoryId: response.categoryId,
            }, categories);
          } else if (response.type === 'existing' && response.categoryId) {
            await this.handleExistingCategory(transaction, {
              categoryId: response.categoryId,
            }, categories);
          } else if (response.type === 'new' && response.newCategory) {
            this.trackNewCategory(
              transaction,
              response.newCategory,
              suggestedCategories,
            );
          } else {
            console.warn(`Unexpected response format: ${JSON.stringify(response)}`);
            await this.actualApiService.updateTransactionNotes(
              transaction.id,
              this.appendTag(transaction.notes ?? '', this.notGuessedTag),
            );
          }
        } catch (error) {
          console.error(`Error processing transaction ${globalIndex + 1}:`, error);
          await this.actualApiService.updateTransactionNotes(
            transaction.id,
            this.appendTag(transaction.notes ?? '', this.notGuessedTag),
          );
        }
      }, Promise.resolve());

      // Add a small delay between batches to avoid overwhelming the API
      if (batchEnd < uncategorizedTransactions.length) {
        console.log('Pausing for 2 seconds before next batch...');
        await new Promise((resolve) => {
          setTimeout(resolve, 2000);
        });
      }
    }

    // Create new categories if not in dry run mode
    if (this.suggestNewCategories && suggestedCategories.size > 0) {
      // Optimize categories before applying/reporting
      const optimizedCategories = this.optimizeCategorySuggestions(suggestedCategories);

      if (this.dryRun) {
        console.log(`\nDRY RUN: Would create ${optimizedCategories.size} new categories after optimization:`);
        Array.from(optimizedCategories.entries()).forEach(([_, suggestion]) => {
          console.log(
            `- ${suggestion.name} in ${suggestion.groupIsNew ? 'new' : 'existing'} group "${suggestion.groupName}"`,
            `for ${suggestion.transactions.length} transactions`,
          );
        });
      } else {
        console.log(`Creating ${optimizedCategories.size} optimized categories`);

        // Use optimized categories instead of original suggestions
        await Promise.all(
          Array.from(optimizedCategories.entries()).map(async ([_, suggestion]) => {
            try {
              // First, ensure we have a group ID
              let groupId: string;
              if (suggestion.groupIsNew) {
                groupId = await this.actualApiService.createCategoryGroup(suggestion.groupName);
                console.log(`Created new category group "${suggestion.groupName}" with ID ${groupId}`);
              } else {
                // Find existing group with matching name
                const existingGroup = categoryGroups.find(
                  (g) => g.name.toLowerCase() === suggestion.groupName.toLowerCase(),
                );
                if (existingGroup) {
                  groupId = existingGroup.id;
                } else {
                  // Create group if not found
                  groupId = await this.actualApiService.createCategoryGroup(suggestion.groupName);
                  console.log(`Created category group "${suggestion.groupName}" with ID ${groupId}`);
                }
              }

              const newCategoryId = await this.actualApiService.createCategory(
                suggestion.name,
                groupId,
              );

              console.log(`Created new category "${suggestion.name}" with ID ${newCategoryId}`);

              // Use Promise.all with map for nested async operations
              await Promise.all(
                suggestion.transactions.map(async (transaction) => {
                  await this.actualApiService.updateTransactionNotesAndCategory(
                    transaction.id,
                    this.appendTag(transaction.notes ?? '', this.guessedTag),
                    newCategoryId,
                  );
                  console.log(`Assigned transaction ${transaction.id} to new category ${suggestion.name}`);
                }),
              );
            } catch (error) {
              console.error(`Error creating category ${suggestion.name}:`, error);
            }
          }),
        );
      }
    }
  }

  private async handleRuleMatch(
    transaction: TransactionEntity,
    response: { categoryId: string; ruleName: string },
    categories: CategoryEntity[],
  ) {
    const category = categories.find((c) => c.id === response.categoryId);
    const categoryName = category ? category.name : 'Unknown Category';

    if (this.dryRun) {
      console.log(`DRY RUN: Would assign transaction ${transaction.id} to category "${categoryName}" (${response.categoryId}) via rule ${response.ruleName}`);
      return;
    }

    await this.actualApiService.updateTransactionNotesAndCategory(
      transaction.id,
      this.appendTag(transaction.notes ?? '', `${this.guessedTag} (rule: ${response.ruleName})`),
      response.categoryId,
    );
  }

  private async handleExistingCategory(
    transaction: TransactionEntity,
    response: { categoryId: string },
    categories: CategoryEntity[],
  ) {
    const category = categories.find((c) => c.id === response.categoryId);
    if (!category) return;

    if (this.dryRun) {
      console.log(`DRY RUN: Would assign transaction ${transaction.id} to existing category ${category.name}`);
      return;
    }

    console.log(`Using existing category: ${category.name}`);
    await this.actualApiService.updateTransactionNotesAndCategory(
      transaction.id,
      this.appendTag(transaction.notes ?? '', this.guessedTag),
      response.categoryId,
    );
  }

  private trackNewCategory(
    transaction: TransactionEntity,
    newCategory: CategorySuggestion,
    suggestedCategories: Map<string, {
      name: string;
      groupName: string;
      groupIsNew: boolean;
      groupId?: string;
      transactions: TransactionEntity[];
    }>,
  ) {
    const categoryKey = `${newCategory.groupName}:${newCategory.name}`;

    const existing = suggestedCategories.get(categoryKey);
    if (existing) {
      existing.transactions.push(transaction);
    } else {
      suggestedCategories.set(categoryKey, {
        ...newCategory,
        transactions: [transaction],
      });
    }
  }

  // Add this new method to optimize category suggestions
  private calculateNameSimilarity(name1: string, name2: string): number {
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

  private optimizeCategorySuggestions(
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
        const sim = this.calculateNameSimilarity(suggestions[i].name, suggestions[j].name);
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
}

export default TransactionService;
