import {
  RuleEntity,
  TransactionEntity,
} from '@actual-app/core/src/types/models';
import { APIPayeeEntity } from '@actual-app/core/src/server/api-models';
import {
  ActualApiServiceI, APICategoryEntity, APICategoryGroupEntity,
  LlmServiceI, ProcessingStrategyI,
  PromptGeneratorI,
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
    transactions: TransactionEntity[],
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
    try {
      if (transactions.length === 0) return;
      const prompt = this.promptGenerator.generate(
        categoryGroups,
        transactions,
        payees,
        rules,
      );

      const responses = await this.llmService.ask(prompt);

      for (const transaction of transactions) {
        const response = responses.find(r => r.transactionId === transaction.id);
        
        if (!response) {
          console.warn(`No mapped JSON response returned from LLM for transaction: ${transaction.id}`);
          await this.actualApiService.updateTransactionNotes(
            transaction,
            this.tagService.addNotGuessedTag(transaction.notes ?? ''),
          );
          continue;
        }

        const strategy = this.processingStrategies.find((s) => s.isSatisfiedBy(response));
        if (strategy) {
          await strategy.process(transaction, response, categories, suggestedCategories);
        } else {
          console.warn(`Unexpected response strategy format: ${JSON.stringify(response)}`);
          await this.actualApiService.updateTransactionNotes(
            transaction,
            this.tagService.addNotGuessedTag(transaction.notes ?? ''),
          );
        }
      }
    } catch (error) {
      console.error(`Error processing transaction batch:`, error);
      for (const transaction of transactions) {
        await this.actualApiService.updateTransactionNotes(
          transaction,
          this.tagService.addNotGuessedTag(transaction.notes ?? ''),
        );
      }
    }
  }
}

export default TransactionProcessor;
