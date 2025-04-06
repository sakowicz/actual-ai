import type { CategoryEntity, TransactionEntity } from '@actual-app/api/@types/loot-core/types/models';
import type {
  ActualApiServiceI,
} from '../types';
import { isFeatureEnabled } from '../config';
import TagService from './tag-service';

class ExistingCategoryHandler {
  private readonly actualApiService: ActualApiServiceI;

  private readonly tagService: TagService;

  constructor(
    actualApiService: ActualApiServiceI,
    tagService: TagService,
  ) {
    this.actualApiService = actualApiService;
    this.tagService = tagService;
  }

  public async handleExistingCategory(
    transaction: TransactionEntity,
    response: { categoryId: string },
    categories: CategoryEntity[],
  ) {
    const category = categories.find((c) => c.id === response.categoryId);
    if (!category) {
      // Add not guessed tag when category not found
      await this.actualApiService.updateTransactionNotes(
        transaction.id,
        this.tagService.addNotGuessedTag(transaction.notes ?? ''),
      );
      return;
    }

    if (isFeatureEnabled('dryRun')) {
      console.log(`DRY RUN: Would assign transaction ${transaction.id} to existing category ${category.name}`);
      return;
    }

    console.log(`Using existing category: ${category.name}`);
    await this.actualApiService.updateTransactionNotesAndCategory(
      transaction.id,
      this.tagService.addGuessedTag(transaction.notes ?? ''),
      response.categoryId,
    );
  }
}

export default ExistingCategoryHandler;
