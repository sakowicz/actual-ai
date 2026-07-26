import type { TransactionEntity } from '@actual-app/core/types/models';
import type {
  ActualApiServiceI, LlmServiceI, ProcessingStrategyI, PromptGeneratorI,
} from '../src/types';
import TransactionProcessor from '../src/transaction/transaction-processor';
import TagService from '../src/transaction/tag-service';

describe('TransactionProcessor', () => {
  it('does not mark a transaction as missed when the LLM provider fails', async () => {
    const actualApiService = {
      updateTransactionNotes: jest.fn(),
    } as unknown as ActualApiServiceI;
    const llmService = {
      ask: jest.fn().mockRejectedValue(new Error('OpenAI returned HTTP 401')),
    } as unknown as LlmServiceI;
    const promptGenerator = {
      generate: jest.fn().mockReturnValue('categorize this'),
    } as unknown as PromptGeneratorI;
    const processor = new TransactionProcessor(
      actualApiService,
      llmService,
      promptGenerator,
      new TagService('#actual-ai-miss', '#actual-ai'),
      [] as ProcessingStrategyI[],
    );
    const transaction: TransactionEntity = {
      id: 'transaction-1',
      account: 'account-1',
      amount: -1200,
      date: '2026-07-26',
      notes: 'Lunch',
    };

    await processor.process(transaction, [], [], [], [], new Map());

    expect(actualApiService.updateTransactionNotes).not.toHaveBeenCalled();
  });
});
