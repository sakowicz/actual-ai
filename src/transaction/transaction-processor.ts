import {
  RuleEntity,
  TransactionEntity,
} from '@actual-app/api/@types/loot-core/types/models';
import { APIPayeeEntity } from '@actual-app/api/@types/loot-core/server/api-models';
import {
  ActualApiServiceI, APICategoryEntity, APICategoryGroupEntity,
  LlmServiceI,
  PromptGeneratorI,
} from '../types';
import TagService from './tag-service';
import RuleMatchHandler from './rule-match-handler';
import ExistingCategoryHandler from './existing-category-handler';
import NewCategoryHandler from './new-category-handler';

const BATCH_SIZE = 20;

class TransactionProcessor {
  private readonly actualApiService: ActualApiServiceI;

  private readonly llmService: LlmServiceI;

  private readonly promptGenerator: PromptGeneratorI;

  private readonly tagService: TagService;

  private readonly ruleMatchHandler: RuleMatchHandler;

  private readonly existingCategoryHandler: ExistingCategoryHandler;

  private readonly newCategoryHandler: NewCategoryHandler;

  constructor(
    actualApiClient: ActualApiServiceI,
    llmService: LlmServiceI,
    promptGenerator: PromptGeneratorI,
    tagService: TagService,
    ruleMatchHandler: RuleMatchHandler,
    existingCategoryHandler: ExistingCategoryHandler,
    newCategoryHandler: NewCategoryHandler,
  ) {
    this.actualApiService = actualApiClient;
    this.llmService = llmService;
    this.promptGenerator = promptGenerator;
    this.tagService = tagService;
    this.ruleMatchHandler = ruleMatchHandler;
    this.existingCategoryHandler = existingCategoryHandler;
    this.newCategoryHandler = newCategoryHandler;
  }

  public async process(
    uncategorizedTransactions: TransactionEntity[],
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
    for (
      let batchStart = 0;
      batchStart < uncategorizedTransactions.length;
      batchStart += BATCH_SIZE
    ) {
      const batchEnd = Math.min(batchStart + BATCH_SIZE, uncategorizedTransactions.length);
      console.log(`Processing batch ${batchStart / BATCH_SIZE + 1} (transactions ${batchStart + 1}-${batchEnd})`);

      const batch = uncategorizedTransactions.slice(batchStart, batchEnd);

      await batch.reduce(async (previousPromise, transaction, batchIndex) => {
        await previousPromise;
        const globalIndex = batchStart + batchIndex;
        console.log(
          `${globalIndex + 1}/${uncategorizedTransactions.length} Processing transaction '${transaction.imported_payee}'`,
        );

        try {
          const prompt = this.promptGenerator.generate(
            categoryGroups,
            transaction,
            payees,
            rules,
          );

          const response = await this.llmService.ask(prompt);

          if (response.type === 'rule' && response.ruleName && response.categoryId) {
            await this.ruleMatchHandler.handleRuleMatch(transaction, {
              ruleName: response.ruleName,
              categoryId: response.categoryId,
            }, categories);
          } else if (response.type === 'existing' && response.categoryId) {
            await this.existingCategoryHandler.handleExistingCategory(transaction, {
              categoryId: response.categoryId,
            }, categories);
          } else if (response.type === 'new' && response.newCategory) {
            this.newCategoryHandler.trackNewCategory(
              transaction,
              response.newCategory,
              suggestedCategories,
            );
          } else {
            console.warn(`Unexpected response format: ${JSON.stringify(response)}`);
            await this.actualApiService.updateTransactionNotes(
              transaction.id,
              this.tagService.addNotGuessedTag(transaction.notes ?? ''),
            );
          }
        } catch (error) {
          console.error(`Error processing transaction ${globalIndex + 1}:`, error);
          await this.actualApiService.updateTransactionNotes(
            transaction.id,
            this.tagService.addNotGuessedTag(transaction.notes ?? ''),
          );
        }
      }, Promise.resolve());

      // Add a small delay between batches to avoid overwhelming the API
      if (batchEnd < uncategorizedTransactions.length) {
        console.log('Pausing for 2 seconds before next batch...');
        await new Promise((resolve) => {
          setTimeout(resolve, 2000);
        });
      }
    }
  }
}

export default TransactionProcessor;
