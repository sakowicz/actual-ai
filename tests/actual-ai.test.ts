import {
  APIAccountEntity,
  APICategoryEntity,
  APICategoryGroupEntity,
  APIPayeeEntity,
} from '@actual-app/api/@types/loot-core/server/api-models';
import TransactionService from '../src/transaction-service';
import InMemoryActualApiService from './test-doubles/in-memory-actual-api-service';
import MockedLlmService from './test-doubles/mocked-llm-service';
import MockedPromptGenerator from './test-doubles/mocked-prompt-generator';
import GivenActualData from './test-doubles/given/given-actual-data';
import ActualAiService from '../src/actual-ai';

describe('ActualAiService', () => {
  let sut: ActualAiService;
  let transactionService: TransactionService;
  let inMemoryApiService: InMemoryActualApiService;
  let mockedLlmService: MockedLlmService;
  let mockedPromptGenerator: MockedPromptGenerator;
  let syncAccountsBeforeClassify = false;
  const GUESSED_TAG = '#actual-ai';
  const NOT_GUESSED_TAG = '#actual-ai-miss';

  beforeEach(() => {
    inMemoryApiService = new InMemoryActualApiService();
    mockedLlmService = new MockedLlmService();
    mockedPromptGenerator = new MockedPromptGenerator();
    const categoryGroups: APICategoryGroupEntity[] = GivenActualData.createSampleCategoryGroups();
    const categories: APICategoryEntity[] = GivenActualData.createSampleCategories();
    const payees: APIPayeeEntity[] = GivenActualData.createSamplePayees();
    const accounts: APIAccountEntity[] = GivenActualData.createSampleAccounts();
    transactionService = new TransactionService(
      inMemoryApiService,
      mockedLlmService,
      mockedPromptGenerator,
      NOT_GUESSED_TAG,
      GUESSED_TAG,
    );
    inMemoryApiService.setCategoryGroups(categoryGroups);
    inMemoryApiService.setCategories(categories);
    inMemoryApiService.setPayees(payees);
    inMemoryApiService.setAccounts(accounts);
  });

  it('It should assign a category to transaction', async () => {
    // Arrange
    const transaction = GivenActualData.createTransaction(
      '1',
      -123,
      'Carrefour 1234',
      'Carrefour XXXX1234567 822-307-2000',
    );
    inMemoryApiService.setTransactions([transaction]);
    mockedLlmService.setGuess(GivenActualData.CATEGORY_GROCERIES);

    // Act
    sut = new ActualAiService(
      transactionService,
      inMemoryApiService,
      syncAccountsBeforeClassify,
    );
    await sut.classify();

    // Assert
    const updatedTransactions = await inMemoryApiService.getTransactions();
    expect(updatedTransactions[0].category).toBe(GivenActualData.CATEGORY_GROCERIES);
  });

  it('It should assign a category to transaction when guess contain category id', async () => {
    // Arrange
    const transaction = GivenActualData.createTransaction(
      '1',
      -123,
      'Carrefour 1234',
      'Carrefour XXXX1234567 822-307-2000',
    );
    inMemoryApiService.setTransactions([transaction]);
    mockedLlmService.setGuess(`I think that the category id will be ${GivenActualData.CATEGORY_GROCERIES}`);

    // Act
    sut = new ActualAiService(
      transactionService,
      inMemoryApiService,
      syncAccountsBeforeClassify,
    );
    await sut.classify();

    // Assert
    const updatedTransactions = await inMemoryApiService.getTransactions();
    expect(updatedTransactions[0].category).toBe(GivenActualData.CATEGORY_GROCERIES);
  });

  it('It should process off-budget transaction when flag is set to false', async () => {
    // Arrange
    const transactionOffBudget = GivenActualData.createTransaction(
      '1',
      -123,
      'Carrefour 1234',
      'Carrefour XXXX1234567 822-307-2000',
      undefined,
      GivenActualData.ACCOUNT_OFF_BUDGET,
    );
    inMemoryApiService.setTransactions([transactionOffBudget]);
    mockedLlmService.setGuess(GivenActualData.CATEGORY_GROCERIES);

    // Act
    sut = new ActualAiService(
      transactionService,
      inMemoryApiService,
      syncAccountsBeforeClassify,
    );
    await sut.classify();

    // Assert
    const updatedTransactions = await inMemoryApiService.getTransactions();
    expect(updatedTransactions[0].category).toBe(undefined);
  });

  it('It should assign a notes to guessed transaction', async () => {
    // Arrange
    const transaction = GivenActualData.createTransaction(
      '1',
      -123,
      'Carrefour 1234',
      'Carrefour XXXX1234567 822-307-2000',
    );
    inMemoryApiService.setTransactions([transaction]);
    mockedLlmService.setGuess(GivenActualData.CATEGORY_GROCERIES);

    // Act
    sut = new ActualAiService(
      transactionService,
      inMemoryApiService,
      syncAccountsBeforeClassify,
    );
    await sut.classify();

    // Assert
    const updatedTransactions = await inMemoryApiService.getTransactions();
    expect(updatedTransactions[0].notes).toBe('Carrefour XXXX1234567 822-307-2000 #actual-ai');
  });

  it('It should assign a notes to guessed transaction when LLM returned category name instead of ID', async () => {
    // Arrange
    const transaction = GivenActualData.createTransaction(
      '1',
      -123,
      'Carrefour 1234',
      'Carrefour XXXX1234567 822-307-2000',
    );
    inMemoryApiService.setTransactions([transaction]);
    mockedLlmService.setGuess('Groceries');

    // Act
    sut = new ActualAiService(
      transactionService,
      inMemoryApiService,
      syncAccountsBeforeClassify,
    );
    await sut.classify();

    // Assert
    const updatedTransactions = await inMemoryApiService.getTransactions();
    expect(updatedTransactions[0].notes).toBe('Carrefour XXXX1234567 822-307-2000 #actual-ai');
  });

  it('It should assign a notes to not guessed transaction', async () => {
    // Arrange
    const transaction = GivenActualData.createTransaction(
      '1',
      -123,
      'Carrefour 1234',
      'Carrefour XXXX1234567 822-307-2000',
    );
    inMemoryApiService.setTransactions([transaction]);

    // Act
    sut = new ActualAiService(
      transactionService,
      inMemoryApiService,
      syncAccountsBeforeClassify,
    );
    await sut.classify();

    // Assert
    const updatedTransactions = await inMemoryApiService.getTransactions();
    expect(updatedTransactions[0].notes).toBe('Carrefour XXXX1234567 822-307-2000 #actual-ai-miss');
  });

  it('It should skip transaction not guessed before', async () => {
    // Arrange
    const transaction = GivenActualData.createTransaction(
      '1',
      -123,
      'Carrefour 1234',
      'Carrefour XXXX1234567 822-307-2000 | #actual-ai-miss',
    );
    inMemoryApiService.setTransactions([transaction]);
    mockedLlmService.setGuess(GivenActualData.CATEGORY_GROCERIES);

    // Act
    sut = new ActualAiService(
      transactionService,
      inMemoryApiService,
      syncAccountsBeforeClassify,
    );
    await sut.classify();

    // Assert
    const updatedTransactions = await inMemoryApiService.getTransactions();
    expect(updatedTransactions[0].category).toBe(undefined);
  });

  it('It should not process parent transactions', async () => {
    // Arrange
    const transaction = GivenActualData.createTransaction(
      '1',
      -123,
      'Carrefour 1234',
      'Carrefour XXXX1234567 822-307-2000',
      undefined,
      '1',
      '2021-01-01',
      true,
    );
    inMemoryApiService.setTransactions([transaction]);

    // Act
    sut = new ActualAiService(
      transactionService,
      inMemoryApiService,
      syncAccountsBeforeClassify,
    );
    await sut.classify();

    // Assert
    const updatedTransactions = await inMemoryApiService.getTransactions();
    expect(updatedTransactions[0].category).toBe(undefined);
  });

  it('It migrate legacy transactions to tag', async () => {
    // Arrange
    const transactionNotGuessed = GivenActualData.createTransaction(
      '1',
      -123,
      'Carrefour 1235',
      'Carrefour XXXX1234567 822-307-2000 | actual-ai could not guess this category',
    );
    const transactionGuessed = GivenActualData.createTransaction(
      '2',
      -123,
      'Carrefour 1234',
      'Carrefour XXXX1234567 822-307-3000 | actual-ai guessed this category',
      undefined,
      '1',
      '2021-01-01',
      false,
      GivenActualData.CATEGORY_GROCERIES,
    );
    inMemoryApiService.setTransactions([transactionNotGuessed, transactionGuessed]);

    // Act
    sut = new ActualAiService(
      transactionService,
      inMemoryApiService,
      syncAccountsBeforeClassify,
    );
    await sut.classify();

    // Assert
    const updatedTransactions = await inMemoryApiService.getTransactions();
    expect(updatedTransactions[0].notes).toBe('Carrefour XXXX1234567 822-307-2000 #actual-ai-miss');
    expect(updatedTransactions[1].notes).toBe('Carrefour XXXX1234567 822-307-3000 #actual-ai');
  });

  it('Clean up existing multiple notes', async () => {
    // Arrange
    const transaction = GivenActualData.createTransaction(
      '1',
      -123,
      'Carrefour 1235',
      'Carrefour XXXX1234567 822-307-3000  | actual-ai guessed this category | actual-ai guessed this category | actual-ai guessed this category #actual-ai',
      undefined,
      '1',
      '2021-01-01',
      false,
      GivenActualData.CATEGORY_GROCERIES,
    );

    inMemoryApiService.setTransactions([transaction]);

    // Act
    sut = new ActualAiService(
      transactionService,
      inMemoryApiService,
      syncAccountsBeforeClassify,
    );
    await sut.classify();

    // Assert
    const updatedTransactions = await inMemoryApiService.getTransactions();
    expect(updatedTransactions[0].notes).toBe('Carrefour XXXX1234567 822-307-3000 #actual-ai');
  });

  it('Do not migrate transaction that not mean to be migrated', async () => {
    // Arrange
    const transaction1 = GivenActualData.createTransaction(
      '1',
      -123,
      'Carrefour 1235',
      'Carrefour XXXX1234567 822-307-2000',
      undefined,
      '1',
      '2021-01-01',
      false,
      GivenActualData.CATEGORY_GROCERIES,
    );
    const transaction2 = GivenActualData.createTransaction(
      '2',
      -123,
      'Carrefour 1234',
      'Carrefour XXXX1234567 822-307-3000 #actual-ai',
      undefined,
      '1',
      '2021-01-01',
      false,
      GivenActualData.CATEGORY_GROCERIES,
    );
    const transaction3 = GivenActualData.createTransaction(
      '3',
      -123,
      'Carrefour 1234',
      'Carrefour XXXX1234567 822-307-3000 #actual-ai-miss',
    );
    inMemoryApiService.setTransactions([transaction1, transaction2, transaction3]);
    mockedLlmService.setGuess(GivenActualData.CATEGORY_GROCERIES);

    // Act
    sut = new ActualAiService(
      transactionService,
      inMemoryApiService,
      syncAccountsBeforeClassify,
    );
    await sut.classify();

    // Assert
    const transactions = await inMemoryApiService.getTransactions();

    expect(transactions[0].notes).toBe('Carrefour XXXX1234567 822-307-2000');
    expect(transactions[1].notes).toBe('Carrefour XXXX1234567 822-307-3000 #actual-ai');
    expect(transactions[2].notes).toBe('Carrefour XXXX1234567 822-307-3000 #actual-ai-miss');
  });

  it('It should run bank sync when flag is set', async () => {
    // Arrange
    syncAccountsBeforeClassify = true;

    // Act
    sut = new ActualAiService(
      transactionService,
      inMemoryApiService,
      syncAccountsBeforeClassify,
    );
    await sut.classify();

    // Assert
    expect(inMemoryApiService.getWasBankSyncRan()).toBe(true);
  });
});
