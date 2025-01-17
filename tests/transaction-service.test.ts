import {
  APICategoryEntity,
  APICategoryGroupEntity,
  APIPayeeEntity,
} from '@actual-app/api/@types/loot-core/server/api-models';
import TransactionService from '../src/transaction-service';
import InMemoryActualApiService from './test-doubles/in-memory-actual-api-service';
import MockedLlmService from './test-doubles/mocked-llm-service';
import MockedPromptGenerator from './test-doubles/mocked-prompt-generator';
import GivenActualData from './test-doubles/given/given-actual-data';

describe('TransactionService', () => {
  let sut: TransactionService;
  let inMemoryApiService: InMemoryActualApiService;
  let mockedLlmService: MockedLlmService;
  let mockedPromptGenerator: MockedPromptGenerator;
  let shouldRunBankSync = false;

  beforeEach(() => {
    inMemoryApiService = new InMemoryActualApiService();
    mockedLlmService = new MockedLlmService();
    mockedPromptGenerator = new MockedPromptGenerator();
    const categoryGroups: APICategoryGroupEntity[] = GivenActualData.createSampleCategoryGroups();
    const categories: APICategoryEntity[] = GivenActualData.createSampleCategories();
    const payees: APIPayeeEntity[] = GivenActualData.createSamplePayees();

    inMemoryApiService.setCategoryGroups(categoryGroups);
    inMemoryApiService.setCategories(categories);
    inMemoryApiService.setPayees(payees);
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
    sut = new TransactionService(
      inMemoryApiService,
      mockedLlmService,
      mockedPromptGenerator,
      shouldRunBankSync,
    );
    await sut.processTransactions();

    // Assert
    const updatedTransactions = await inMemoryApiService.getTransactions();
    expect(updatedTransactions[0].category).toBe(GivenActualData.CATEGORY_GROCERIES);
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
    sut = new TransactionService(
      inMemoryApiService,
      mockedLlmService,
      mockedPromptGenerator,
      shouldRunBankSync,
    );
    await sut.processTransactions();

    // Assert
    const updatedTransactions = await inMemoryApiService.getTransactions();
    expect(updatedTransactions[0].notes).toBe('Carrefour XXXX1234567 822-307-2000 | actual-ai guessed this category');
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
    sut = new TransactionService(
      inMemoryApiService,
      mockedLlmService,
      mockedPromptGenerator,
      shouldRunBankSync,
    );
    await sut.processTransactions();

    // Assert
    const updatedTransactions = await inMemoryApiService.getTransactions();
    expect(updatedTransactions[0].notes).toBe('Carrefour XXXX1234567 822-307-2000 | actual-ai could not guess this category');
  });

  it('It should skip transaction not guessed before', async () => {
    // Arrange
    const transaction = GivenActualData.createTransaction(
      '1',
      -123,
      'Carrefour 1234',
      'Carrefour XXXX1234567 822-307-2000 | actual-ai could not guess this category',
    );
    inMemoryApiService.setTransactions([transaction]);
    mockedLlmService.setGuess(GivenActualData.CATEGORY_GROCERIES);

    // Act
    sut = new TransactionService(
      inMemoryApiService,
      mockedLlmService,
      mockedPromptGenerator,
      shouldRunBankSync,
    );
    await sut.processTransactions();

    // Assert
    const updatedTransactions = await inMemoryApiService.getTransactions();
    expect(updatedTransactions[0].category).toBe(undefined);
  });

  it('It should run bank sync when flag is set', async () => {
    // Arrange
    shouldRunBankSync = true;

    // Act
    sut = new TransactionService(
      inMemoryApiService,
      mockedLlmService,
      mockedPromptGenerator,
      shouldRunBankSync,
    );
    await sut.processTransactions();

    // Assert
    expect(inMemoryApiService.getWasBankSyncRan()).toBe(true);
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
    mockedLlmService.setGuess(GivenActualData.CATEGORY_GROCERIES);

    // Act
    sut = new TransactionService(
      inMemoryApiService,
      mockedLlmService,
      mockedPromptGenerator,
      shouldRunBankSync,
    );
    await sut.processTransactions();

    // Assert
    const updatedTransactions = await inMemoryApiService.getTransactions();
    expect(updatedTransactions[0].category).toBe(undefined);
  });
});
