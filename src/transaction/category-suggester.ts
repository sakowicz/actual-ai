import type { TransactionEntity } from '@actual-app/api/@types/loot-core/types/models';
import type { ActualApiServiceI } from '../types';
import { APICategoryGroupEntity } from '../types';
import { isFeatureEnabled } from '../config';
import CategorySuggestionOptimizer from '../category-suggestion-optimizer';
import TagService from './tag-service';

class CategorySuggester {
  private readonly actualApiService: ActualApiServiceI;

  private readonly categorySuggestionOptimizer: CategorySuggestionOptimizer;

  private readonly guessedTag: string;

  private readonly tagService: TagService;

  constructor(
    actualApiService: ActualApiServiceI,
    categorySuggestionOptimizer: CategorySuggestionOptimizer,
    guessedTag: string,
    tagService: TagService,
  ) {
    this.actualApiService = actualApiService;
    this.categorySuggestionOptimizer = categorySuggestionOptimizer;
    this.guessedTag = guessedTag;
    this.tagService = tagService;
  }

  public async suggest(
    suggestedCategories: Map<string, {
            name: string;
            groupName: string;
            groupIsNew: boolean;
            groupId?: string;
            transactions: TransactionEntity[];
        }>,
    uncategorizedTransactions: TransactionEntity[],
    categoryGroups: APICategoryGroupEntity[],
  ): Promise<void> {
    // Optimize categories before applying/reporting
    const optimizedCategories = this.categorySuggestionOptimizer
      .optimizeCategorySuggestions(suggestedCategories);

    if (isFeatureEnabled('dryRun')) {
      console.log(`\nDRY RUN: Would create ${optimizedCategories.size} new categories after optimization:`);
      Array.from(optimizedCategories.entries()).forEach(([_, suggestion]) => {
        console.log(
          `- ${suggestion.name} in ${suggestion.groupIsNew ? 'new' : 'existing'} group "${suggestion.groupName}"`,
          `for ${suggestion.transactions.length} transactions`,
        );
      });
    } else if (isFeatureEnabled('dryRunNewCategories')) {
      console.log(`\nDRY RUN CATEGORIES: Would create ${optimizedCategories.size} new categories:`);
      Array.from(optimizedCategories.entries()).forEach(([_, suggestion]) => {
        console.log(
          `- ${suggestion.name} in ${suggestion.groupIsNew ? 'new' : 'existing'} group "${suggestion.groupName}"`,
          `for ${suggestion.transactions.length} transactions`,
        );
      });

      // Don't create categories but log which transactions would be affected
      uncategorizedTransactions.forEach((uncategorizedTransaction) => {
        // Skip transactions needing new categories in dry run mode
        console.log(
          `Skipping categorization for '${uncategorizedTransaction.imported_payee}' `
                    + 'as it needs a new category',
        );
      });
    } else {
      console.log(`Creating ${optimizedCategories.size} optimized categories`);

      // Use optimized categories instead of original suggestions
      await Promise.all(
        Array.from(optimizedCategories.entries()).map(async ([_key, suggestion]) => {
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
              groupId = existingGroup?.id
                                ?? await this.actualApiService.createCategoryGroup(
                                  suggestion.groupName,
                                );
            }

            // Validate groupId exists before creating category
            if (!groupId) {
              throw new Error(`Missing groupId for category ${suggestion.name}`);
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
                  this.tagService.appendTag(transaction.notes ?? '', this.guessedTag),
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

export default CategorySuggester;
