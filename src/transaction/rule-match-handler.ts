import type { CategoryEntity, TransactionEntity } from '@actual-app/api/@types/loot-core/types/models';
import type {
  ActualApiServiceI,
} from '../types';
import { isFeatureEnabled } from '../config';
import TagService from './tag-service';

class RuleMatchHandler {
  private readonly actualApiService: ActualApiServiceI;

  private readonly tagService: TagService;

  constructor(
    actualApiService: ActualApiServiceI,
    tagService: TagService,
  ) {
    this.actualApiService = actualApiService;
    this.tagService = tagService;
  }

  async handleRuleMatch(
    transaction: TransactionEntity,
    response: { categoryId: string; ruleName: string },
    categories: CategoryEntity[],
  ) {
    const category = categories.find((c) => c.id === response.categoryId);
    const categoryName = category ? category.name : 'Unknown Category';

    if (isFeatureEnabled('dryRun')) {
      console.log(`DRY RUN: Would assign transaction ${transaction.id} to category "${categoryName}" (${response.categoryId}) via rule ${response.ruleName}`);
      return;
    }

    let updatedNotes = this.tagService.addGuessedTag(transaction.notes ?? '');
    updatedNotes = `${updatedNotes} (rule: ${response.ruleName})`;

    await this.actualApiService.updateTransactionNotesAndCategory(
      transaction.id,
      updatedNotes,
      response.categoryId,
    );
  }
}

export default RuleMatchHandler;
