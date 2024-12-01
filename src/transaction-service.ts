import { LanguageModel } from 'ai';
import { APICategoryGroupEntity, APIPayeeEntity } from '@actual-app/api/@types/loot-core/server/api-models';
import { TransactionEntity } from '@actual-app/api/@types/loot-core/types/models';
import { syncAccountsBeforeClassify } from './config';
import suppressConsoleLogsAsync from './utils';
import {
  LlmModelFactoryI, GenerateTextFunction, TransactionServiceI, PromptGeneratorI, ActualApiServiceI,
} from './types';

const NOTES_NOT_GUESSED = 'actual-ai could not guess this category';
const NOTES_GUESSED = 'actual-ai guessed this category';

class TransactionService implements TransactionServiceI {
  private actualAiService: ActualApiServiceI;

  private generateText: GenerateTextFunction;

  private model: LanguageModel;

  private promptGenerator: PromptGeneratorI;

  constructor(
    actualApiClient: ActualApiServiceI,
    generateText: GenerateTextFunction,
    llmModelFactory: LlmModelFactoryI,
    promptGenerator: PromptGeneratorI,
  ) {
    this.actualAiService = actualApiClient;
    this.generateText = generateText;
    this.model = llmModelFactory.create();
    this.promptGenerator = promptGenerator;
  }

  static findUUIDInString(str: string): string | null {
    const regex = /[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}/g;
    const matchResult = str.match(regex);
    return matchResult ? matchResult[0] : null;
  }

  async syncAccounts(): Promise<void> {
    console.log('Syncing bank accounts');
    try {
      await suppressConsoleLogsAsync(async () => this.actualAiService.runBankSync());
      console.log('Bank accounts synced');
    } catch (error) {
      console.error('Error syncing bank accounts:', error);
    }
  }

  async processTransactions(): Promise<void> {
    if (syncAccountsBeforeClassify) {
      await this.syncAccounts();
    }

    const categoryGroups = await this.actualAiService.getCategoryGroups();
    const categories = await this.actualAiService.getCategories();
    const payees = await this.actualAiService.getPayees();
    const transactions = await this.actualAiService.getTransactions();
    const uncategorizedTransactions = transactions.filter(
      (transaction) => !transaction.category
            && transaction.transfer_id === null
            && transaction.starting_balance_flag !== true
            && transaction.imported_payee !== null
            && transaction.imported_payee !== ''
            && (transaction.notes === null || (!transaction.notes?.includes(NOTES_NOT_GUESSED))),
    );

    for (let i = 0; i < uncategorizedTransactions.length; i++) {
      const transaction = uncategorizedTransactions[i];
      console.log(`${i + 1}/${uncategorizedTransactions.length} Processing transaction ${transaction.imported_payee} / ${transaction.notes} / ${transaction.amount}`);
      const guess = await this.ask(categoryGroups, transaction, payees);
      const guessUUID = TransactionService.findUUIDInString(guess);
      const guessCategory = categories.find((category) => category.id === guessUUID);

      if (!guessCategory) {
        console.warn(`${i + 1}/${uncategorizedTransactions.length} LLM could not classify the transaction. LLM guess: ${guess}`);
        await this.actualAiService.updateTransactionNotes(transaction.id, `${transaction.notes} | ${NOTES_NOT_GUESSED}`);
        continue;
      }
      console.log(`${i + 1}/${uncategorizedTransactions.length} Guess: ${guessCategory.name}`);

      await this.actualAiService.updateTransactionNotesAndCategory(
        transaction.id,
        `${transaction.notes} | ${NOTES_GUESSED}`,
        guessCategory.id,
      );
    }
  }

  async ask(
    categoryGroups: APICategoryGroupEntity[],
    transaction: TransactionEntity,
    payees: APIPayeeEntity[],
  ): Promise<string> {
    const prompt = this.promptGenerator.generate(categoryGroups, transaction, payees);
    const { text } = await this.generateText({
      model: this.model,
      prompt,
      temperature: 0.1,
      max_tokens: 50,
    });

    return text.replace(/(\r\n|\n|\r|"|')/gm, '');
  }
}

export default TransactionService;
