import {
  ActualApiServiceI, LlmServiceI, PromptGeneratorI, TransactionServiceI,
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

  private readonly dryRunNewCategories: boolean;

  constructor(
    actualApiClient: ActualApiServiceI,
    llmService: LlmServiceI,
    promptGenerator: PromptGeneratorI,
    notGuessedTag: string,
    guessedTag: string,
    suggestNewCategories = false,
    dryRunNewCategories = true,
  ) {
    this.actualApiService = actualApiClient;
    this.llmService = llmService;
    this.promptGenerator = promptGenerator;
    this.notGuessedTag = notGuessedTag;
    this.guessedTag = guessedTag;
    this.suggestNewCategories = suggestNewCategories;
    this.dryRunNewCategories = dryRunNewCategories;
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
    const categoryGroups = await this.actualApiService.getCategoryGroups();
    const categories = await this.actualApiService.getCategories();
    const payees = await this.actualApiService.getPayees();
    const transactions = await this.actualApiService.getTransactions();
    const accounts = await this.actualApiService.getAccounts();
    const accountsToSkip = accounts.filter((account) => account.offbudget)
      .map((account) => account.id);

    const uncategorizedTransactions = transactions.filter(
      (transaction) => !transaction.category
        && (transaction.transfer_id === null || transaction.transfer_id === undefined)
        && transaction.starting_balance_flag !== true
        && transaction.imported_payee !== null
        && transaction.imported_payee !== ''
        && (transaction.notes === null || (!transaction.notes?.includes(this.notGuessedTag)))
        && !transaction.is_parent
        && !accountsToSkip.includes(transaction.account),
    );

    console.log(`Found ${uncategorizedTransactions.length} transactions to process`);
    const categoryIds = categories.map((category) => category.id);
    categoryIds.push('uncategorized');

    // Track suggested categories to avoid duplicates and for creating later
    const suggestedCategories = new Map<string, {
      name: string,
      groupId: string,
      transactions: string[],
    }>();

    // Process transactions in batches to avoid hitting rate limits
    for (
      let batchStart = 0;
      batchStart < uncategorizedTransactions.length;
      batchStart += BATCH_SIZE
    ) {
      const batchEnd = Math.min(batchStart + BATCH_SIZE, uncategorizedTransactions.length);
      console.log(`Processing batch ${batchStart / BATCH_SIZE + 1} (transactions ${batchStart + 1}-${batchEnd})`);

      const batch = uncategorizedTransactions.slice(batchStart, batchEnd);

      for (let i = 0; i < batch.length; i++) {
        const transaction = batch[i];
        const globalIndex = batchStart + i;
        console.log(`${globalIndex + 1}/${uncategorizedTransactions.length} Processing transaction ${transaction.imported_payee} / ${transaction.notes} / ${transaction.amount}`);

        try {
          const prompt = this.promptGenerator.generate(categoryGroups, transaction, payees);
          const guess = await this.llmService.ask(prompt, categoryIds);
          let guessCategory = categories.find((category) => category.id === guess);

          if (!guessCategory) {
            guessCategory = categories.find((category) => category.name === guess);
            if (guessCategory) {
              console.warn(`${globalIndex + 1}/${uncategorizedTransactions.length} LLM guessed category name instead of ID. LLM guess: ${guess}`);
            }
          }
          if (!guessCategory) {
            guessCategory = categories.find((category) => guess.includes(category.id));
            if (guessCategory) {
              console.warn(`${globalIndex + 1}/${uncategorizedTransactions.length} Found category ID in LLM guess, but it wasn't 1:1. LLM guess: ${guess}`);
            }
          }

          if (!guessCategory) {
            console.warn(`${globalIndex + 1}/${uncategorizedTransactions.length} LLM could not classify the transaction. LLM guess: ${guess}`);

            // If suggestNewCategories is enabled, try to get a new category suggestion
            if (this.suggestNewCategories) {
              const newCategoryPrompt = this.promptGenerator.generateCategorySuggestion(
                categoryGroups,
                transaction,
                payees,
              );
              const categorySuggestion = await this.llmService.askForCategorySuggestion(
                newCategoryPrompt,
              );

              if (
                categorySuggestion?.name
                && categorySuggestion.groupName
              ) {
                console.log(`${globalIndex + 1}/${uncategorizedTransactions.length} Suggested new category: ${categorySuggestion.name} in group ${categorySuggestion.groupName}`);

                // Find or create category group
                let groupId: string;
                if (categorySuggestion.groupIsNew) {
                  if (this.dryRunNewCategories) {
                    console.log(`Dry run: Would create new category group "${categorySuggestion.groupName}"`);
                    groupId = 'dry-run-group-id';
                  } else {
                    groupId = await this.actualApiService.createCategoryGroup(
                      categorySuggestion.groupName,
                    );
                    console.log(`Created new category group "${categorySuggestion.groupName}" with ID ${groupId}`);
                  }
                } else {
                  const existingGroup = categoryGroups.find(
                    (g) => g.name.toLowerCase() === categorySuggestion.groupName.toLowerCase(),
                  );
                  groupId = existingGroup?.id
                    ?? (this.dryRunNewCategories ? 'dry-run-group-id' : await this.actualApiService.createCategoryGroup(
                      categorySuggestion.groupName,
                    ));
                }

                // Then create category and assign transactions...
                let newCategoryId: string | null = null;
                if (!this.dryRunNewCategories) {
                  newCategoryId = await this.actualApiService.createCategory(
                    categorySuggestion.name,
                    groupId,
                  );
                  console.log(`Created new category "${categorySuggestion.name}" with ID ${newCategoryId}`);
                }

                // Handle transaction assignments
                if (newCategoryId) {
                  await Promise.all(
                    suggestedCategories.get(
                      categorySuggestion.name.toLowerCase(),
                    )?.transactions.map(async (transactionId) => {
                      const uncategorizedTransaction = uncategorizedTransactions.find(
                        (t) => t.id === transactionId,
                      );
                      if (uncategorizedTransaction) {
                        await this.actualApiService.updateTransactionNotesAndCategory(
                          uncategorizedTransaction.id,
                          this.appendTag(uncategorizedTransaction.notes ?? '', this.guessedTag),
                          newCategoryId,
                        );
                        console.log(`Assigned transaction ${uncategorizedTransaction.id} to new category ${categorySuggestion?.name}`);
                      }
                    }) ?? [],
                  );
                }
              } else {
                // Handle invalid/missing category suggestion
                console.log('No valid category suggestion received');
                await this.actualApiService.updateTransactionNotes(
                  transaction.id,
                  this.appendTag(transaction.notes ?? '', this.notGuessedTag),
                );
              }
            } else {
              await this.actualApiService.updateTransactionNotes(transaction.id, this.appendTag(transaction.notes ?? '', this.notGuessedTag));
            }
            continue;
          }
          console.log(`${globalIndex + 1}/${uncategorizedTransactions.length} Guess: ${guessCategory.name}`);

          await this.actualApiService.updateTransactionNotesAndCategory(
            transaction.id,
            this.appendTag(transaction.notes ?? '', this.guessedTag),
            guessCategory.id,
          );
        } catch (error) {
          console.error(`Error processing transaction ${globalIndex + 1}/${uncategorizedTransactions.length}:`, error);
          // Continue with next transaction
        }
      }

      // Add a small delay between batches to avoid overwhelming the API
      if (batchEnd < uncategorizedTransactions.length) {
        console.log('Pausing for 2 seconds before next batch...');
        await new Promise((resolve) => {
          setTimeout(resolve, 2000);
        });
      }
    }

    // Create new categories if not in dry run mode
    if (this.suggestNewCategories && !this.dryRunNewCategories && suggestedCategories.size > 0) {
      console.log(`Creating ${suggestedCategories.size} new categories`);

      // Use Promise.all with map for async operations
      await Promise.all(
        Array.from(suggestedCategories.entries()).map(async ([_, suggestion]) => {
          try {
            const newCategoryId = await this.actualApiService.createCategory(
              suggestion.name,
              suggestion.groupId,
            );

            console.log(`Created new category "${suggestion.name}" with ID ${newCategoryId}`);

            // Use Promise.all with map for nested async operations
            await Promise.all(
              suggestion.transactions.map(async (transactionId) => {
                const transaction = uncategorizedTransactions.find((t) => t.id === transactionId);
                if (transaction) {
                  await this.actualApiService.updateTransactionNotesAndCategory(
                    transactionId,
                    this.appendTag(transaction.notes ?? '', this.guessedTag),
                    newCategoryId,
                  );
                  console.log(`Assigned transaction ${transactionId} to new category ${suggestion.name}`);
                }
              }),
            );
          } catch (error) {
            console.error(`Error creating category ${suggestion.name}:`, error);
          }
        }),
      );
    } else if (
      this.suggestNewCategories && this.dryRunNewCategories && suggestedCategories.size > 0
    ) {
      // Split the longer line to avoid length error
      console.log(
        `Dry run: Would create ${suggestedCategories.size} new categories:`,
      );

      // No need for async here, so we can use forEach
      Array.from(suggestedCategories.entries()).forEach(([_, suggestion]) => {
        console.log(
          `- ${suggestion.name} (in group ${suggestion.groupId}) for ${suggestion.transactions.length} transactions`,
        );
      });
    }
  }
}

export default TransactionService;
