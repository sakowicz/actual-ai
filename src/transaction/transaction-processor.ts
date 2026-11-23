import {
  RuleEntity,
  TransactionEntity,
} from '@actual-app/core/src/types/models';
import { APIPayeeEntity } from '@actual-app/core/src/server/api-models';
import {
  ActualApiServiceI, APICategoryEntity, APICategoryGroupEntity,
  LlmServiceI, ProcessingStrategyI,
  PromptGeneratorI, UnifiedResponse,
} from '../types';
import { transformRulesToDescriptions } from '../utils/rule-utils';
import TagService from './tag-service';

/**
 * A rule reply counts only when it names a rule from the prompt, and then that
 * rule's own category is used. A reply naming any other rule is handled as an
 * ordinary category guess.
 */
function resolveRuleReply(response: UnifiedResponse, rules: RuleEntity[]): UnifiedResponse {
  if (response.type !== 'rule') {
    return response;
  }

  // Same list and labels as the prompt; category names are not needed here.
  const rule = transformRulesToDescriptions(rules, [])
    .find((r) => r.ruleName === response.ruleName);
  if (!rule) {
    console.warn(`The reply names a rule that was not in the prompt: ${response.ruleName}`);
    return { type: 'existing', categoryId: response.categoryId };
  }

  return { ...response, categoryId: rule.categoryId || undefined };
}

class TransactionProcessor {
  private readonly actualApiService: ActualApiServiceI;

  private readonly llmService: LlmServiceI;

  private readonly promptGenerator: PromptGeneratorI;

  private readonly tagService: TagService;

  private readonly processingStrategies: ProcessingStrategyI[];

  constructor(
    actualApiClient: ActualApiServiceI,
    llmService: LlmServiceI,
    promptGenerator: PromptGeneratorI,
    tagService: TagService,
    processingStrategies: ProcessingStrategyI[],
  ) {
    this.actualApiService = actualApiClient;
    this.llmService = llmService;
    this.promptGenerator = promptGenerator;
    this.tagService = tagService;
    this.processingStrategies = processingStrategies;
  }

  public async process(
    transaction: TransactionEntity,
    categoryGroups: APICategoryGroupEntity[],
    payees: APIPayeeEntity[],
    rules: RuleEntity[],
    categories: (APICategoryEntity | APICategoryGroupEntity)[],
    suggestedCategories: Map<string, {
        name: string;
        groupName: string;
        groupIsNew: boolean;
        groupId?: string;
        transactions: TransactionEntity[];
      }>,
    currencyCode: string,
  ): Promise<void> {
    try {
      const prompt = this.promptGenerator.generate(
        categoryGroups,
        transaction,
        payees,
        rules,
        currencyCode,
      );

      const response = resolveRuleReply(await this.llmService.ask(prompt), rules);

      const strategy = this.processingStrategies.find((s) => s.isSatisfiedBy(response));
      if (strategy) {
        await strategy.process(transaction, response, categories, suggestedCategories);
        return;
      }

      console.warn(`Unexpected response format: ${JSON.stringify(response)}`);
      await this.actualApiService.updateTransactionNotes(
        transaction.id,
        this.tagService.addNotGuessedTag(transaction.notes ?? ''),
      );
    } catch (error) {
      console.error(`Error processing transaction ${transaction.id}:`, error);
      await this.actualApiService.updateTransactionNotes(
        transaction.id,
        this.tagService.addNotGuessedTag(transaction.notes ?? ''),
      );
    }
  }
}

export default TransactionProcessor;
