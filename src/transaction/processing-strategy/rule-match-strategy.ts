import type { CategoryEntity, TransactionEntity } from '@actual-app/api/@types/loot-core/src/types/models';
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
    if (response.categoryId === undefined) {
      return false;
    }
    if (response.ruleName === undefined) {
      return false;
    }

    return response.type === 'rule';
  }

  async process(
    transaction: TransactionEntity,
    response: UnifiedResponse,
  ) {
    if (response.categoryId === undefined) {
      throw new Error('No categoryId in response');
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

export default RuleMatchStrategy;
