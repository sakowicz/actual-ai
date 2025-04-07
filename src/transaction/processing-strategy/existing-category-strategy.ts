import type { CategoryEntity, TransactionEntity } from '@actual-app/api/@types/loot-core/types/models';
import type {
  ActualApiServiceI, ProcessingStrategyI, UnifiedResponse,
} from '../../types';
import { isFeatureEnabled } from '../../config';
import TagService from '../tag-service';

class ExistingCategoryStrategy implements ProcessingStrategyI {
  private readonly actualApiService: ActualApiServiceI;

  private readonly tagService: TagService;

  constructor(
    actualApiService: ActualApiServiceI,
    tagService: TagService,
  ) {
    this.actualApiService = actualApiService;
    this.tagService = tagService;
  }

  public isSatisfiedBy(response: UnifiedResponse): boolean {
    if (response.categoryId === undefined) {
      return false;
    }

    return response.type === 'existing';
  }

  public async process(
    transaction: TransactionEntity,
    response: UnifiedResponse,
    categories: CategoryEntity[],
  ) {
    if (response.categoryId === undefined) {
      throw new Error('No categoryId in response');
    }
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

export default ExistingCategoryStrategy;
