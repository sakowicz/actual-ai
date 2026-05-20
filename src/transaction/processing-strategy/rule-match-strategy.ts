import type { TransactionEntity } from '@actual-app/core/src/types/models';
import type {
  ActualApiServiceI, ProcessingStrategyI, UnifiedResponse,
} from '../../types';
import TagService from '../tag-service';

class RuleMatchStrategy implements ProcessingStrategyI {
  private readonly actualApiService: ActualApiServiceI;

  private readonly tagService: TagService;

  constructor(
    actualApiService: ActualApiServiceI,
    tagService: TagService,
  ) {
    this.actualApiService = actualApiService;
    this.tagService = tagService;
  }

  isSatisfiedBy(response: UnifiedResponse): boolean {
    if (response.ruleName === undefined) {
      return false;
    }

    return response.type === 'rule';
  }

  async process(
    transaction: TransactionEntity,
    response: UnifiedResponse,
  ) {
    let updatedNotes = this.tagService.addGuessedTag(transaction.notes ?? '');
    updatedNotes = `${updatedNotes} (rule: ${response.ruleName})`;

    if (response.categoryId) {
      await this.actualApiService.updateTransactionNotesAndCategory(
        transaction,
        updatedNotes,
        response.categoryId,
      );
      return;
    }

    // Rule explicitly leaves the transaction uncategorized — tag the
    // notes so the rule attribution is visible, but don't assign a category.
    await this.actualApiService.updateTransactionNotes(
      transaction,
      updatedNotes,
    );
  }
}

export default RuleMatchStrategy;
