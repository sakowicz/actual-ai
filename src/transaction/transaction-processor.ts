import {
  RuleEntity,
  TransactionEntity,
} from '@actual-app/core/types/models';
import { APIPayeeEntity } from '@actual-app/api/models';
import {
  ActualApiServiceI, APICategoryEntity, APICategoryGroupEntity,
  LlmServiceI, ProcessingStrategyI,
  PromptGeneratorI, UnifiedResponse,
} from '../types';
import TagService from './tag-service';

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
  ): Promise<void> {
    const response = await this.classify(transaction, categoryGroups, payees, rules);
    if (!response) return;
    await this.apply(transaction, response, categories, suggestedCategories);
  }

  public async classify(
    transaction: TransactionEntity,
    categoryGroups: APICategoryGroupEntity[],
    payees: APIPayeeEntity[],
    rules: RuleEntity[],
  ): Promise<UnifiedResponse | undefined> {
    try {
      const prompt = this.promptGenerator.generate(
        categoryGroups,
        transaction,
        payees,
        rules,
      );

      return await this.llmService.ask(prompt);
    } catch (error) {
      console.error(`Error classifying transaction ${transaction.id}:`, error);
      return undefined;
    }
  }

  public async apply(
    transaction: TransactionEntity,
    response: UnifiedResponse,
    categories: (APICategoryEntity | APICategoryGroupEntity)[],
    suggestedCategories: Map<string, {
        name: string;
        groupName: string;
        groupIsNew: boolean;
        groupId?: string;
        transactions: TransactionEntity[];
      }>,
  ): Promise<void> {
    try {
      if (response.type === 'rule' && response.categoryId === 'unknown') {
        console.warn(`Ignoring invalid rule response: ${JSON.stringify(response)}`);
        return;
      }

      const normalizedResponse = response.type === 'rule' && response.ruleName === 'Unnamed rule'
        ? { ...response, type: 'existing' as const }
        : response;
      const strategy = this.processingStrategies.find((s) => s.isSatisfiedBy(normalizedResponse));
      if (strategy) {
        await strategy.process(transaction, normalizedResponse, categories, suggestedCategories);
        return;
      }

      console.warn(`Unexpected response format: ${JSON.stringify(response)}`);
      await this.actualApiService.updateTransactionNotes(
        transaction.id,
        this.tagService.addNotGuessedTag(transaction.notes ?? ''),
      );
    } catch (error) {
      console.error(`Error applying category for transaction ${transaction.id}:`, error);
    }
  }
}

export default TransactionProcessor;
