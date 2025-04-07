import ActualAiService from '../src/actual-ai';
import TransactionService from '../src/transaction-service';
import InMemoryActualApiService from './test-doubles/in-memory-actual-api-service';
import MockedLlmService from './test-doubles/mocked-llm-service';
import MockedPromptGenerator from './test-doubles/mocked-prompt-generator';
import GivenActualData from './test-doubles/given/given-actual-data';
import * as config from '../src/config';
import SimilarityCalculator from '../src/similarity-calculator';
import CategorySuggestionOptimizer from '../src/category-suggestion-optimizer';
import { CategorySuggestion, NotesMigratorI } from '../src/types';
import NotesMigrator from '../src/transaction/notes-migrator';
import TagService from '../src/transaction/tag-service';
import RuleMatchHandler from '../src/transaction/rule-match-handler';
import ExistingCategoryHandler from '../src/transaction/existing-category-handler';
import NewCategoryHandler from '../src/transaction/new-category-handler';
import CategorySuggester from '../src/transaction/category-suggester';
import BatchTransactionProcessor from '../src/transaction/batch-transaction-processor';
import TransactionProcessor from '../src/transaction/transaction-processor';

// Create a reusable mock for isFeatureEnabled
const originalIsFeatureEnabled = config.isFeatureEnabled;
const mockIsFeatureEnabled = jest.spyOn(config, 'isFeatureEnabled');

// Default to having rerunMissedTransactions off for most tests
mockIsFeatureEnabled.mockImplementation((feature: string) => {
  if (feature === 'rerunMissedTransactions') return false;
  if (feature === 'dryRun' || feature === 'dryRunNewCategories') return false;
  return originalIsFeatureEnabled(feature);
});

describe('ActualAiService', () => {
  let sut: ActualAiService;
  let transactionService: TransactionService;
  let inMemoryApiService: InMemoryActualApiService;
  let mockedLlmService: MockedLlmService;
  let mockedPromptGenerator: MockedPromptGenerator;
  let notesMigrator: NotesMigratorI;
  const GUESSED_TAG = '#actual-ai';
  const NOT_GUESSED_TAG = '#actual-ai-miss';

  beforeEach(() => {
    // Reset mock implementation before each test
    mockIsFeatureEnabled.mockImplementation((feature: string) => {
      if (feature === 'rerunMissedTransactions') return false;
      if (feature === 'dryRun' || feature === 'dryRunNewCategories') return false;
      return originalIsFeatureEnabled(feature);
    });

    inMemoryApiService = new InMemoryActualApiService();
    mockedLlmService = new MockedLlmService();
    mockedPromptGenerator = new MockedPromptGenerator();
    const tagService = new TagService(NOT_GUESSED_TAG, GUESSED_TAG);
    const ruleMatchHandler = new RuleMatchHandler(inMemoryApiService, tagService);
    const existingCategoryHandler = new ExistingCategoryHandler(
      inMemoryApiService,
      tagService,
    );
    const categorySuggester = new CategorySuggester(
      inMemoryApiService,
      new CategorySuggestionOptimizer(new SimilarityCalculator()),
      tagService,
    );
    const categoryGroups = GivenActualData.createSampleCategoryGroups();
    const categories = GivenActualData.createSampleCategories();
    const payees = GivenActualData.createSamplePayees();
    const accounts = GivenActualData.createSampleAccounts();
    const rules = GivenActualData.createSampleRules();

    const transactionProcessor = new TransactionProcessor(
      inMemoryApiService,
      mockedLlmService,
      mockedPromptGenerator,
      tagService,
      ruleMatchHandler,
      existingCategoryHandler,
      new NewCategoryHandler(),
    );

    const batchTransactionProcessor = new BatchTransactionProcessor(
      transactionProcessor,
      20,
    );

    transactionService = new TransactionService(
      inMemoryApiService,
      NOT_GUESSED_TAG,
      categorySuggester,
      batchTransactionProcessor,
    );

    inMemoryApiService.setCategoryGroups(categoryGroups);
    inMemoryApiService.setCategories(categories);
    inMemoryApiService.setPayees(payees);
    inMemoryApiService.setAccounts(accounts);
    inMemoryApiService.setRules(rules);
    notesMigrator = new NotesMigrator(inMemoryApiService, tagService);
  });

  afterEach(() => {
    mockIsFeatureEnabled.mockReset();
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
      notesMigrator,
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
    mockedLlmService.setUnifiedResponse({
      type: 'existing',
      categoryId: GivenActualData.CATEGORY_GROCERIES,
    });

    // Act
    sut = new ActualAiService(
      transactionService,
      inMemoryApiService,
      notesMigrator,
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
      notesMigrator,
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
      notesMigrator,
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
      notesMigrator,
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
      notesMigrator,
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

    // Ensure rerunMissedTransactions is false for this test
    mockIsFeatureEnabled.mockImplementation((feature: string) => {
      if (feature === 'rerunMissedTransactions') return false;
      if (feature === 'dryRun' || feature === 'dryRunNewCategories') return false;
      return originalIsFeatureEnabled(feature);
    });

    // Act
    sut = new ActualAiService(
      transactionService,
      inMemoryApiService,
      notesMigrator,
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
      notesMigrator,
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
      'Carrefour XXXX1234567 822-307-2000 #actual-ai-miss',
    );
    const transactionGuessed = GivenActualData.createTransaction(
      '2',
      -123,
      'Carrefour 1234',
      'Carrefour XXXX1234567 822-307-3000 actual-ai guessed this category',
      undefined,
      GivenActualData.ACCOUNT_MAIN,
      '2021-01-01',
      false,
      GivenActualData.CATEGORY_GROCERIES,
    );
    inMemoryApiService.setTransactions([transactionNotGuessed, transactionGuessed]);

    // Act
    sut = new ActualAiService(
      transactionService,
      inMemoryApiService,
      notesMigrator,
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
      notesMigrator,
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

    // Ensure rerunMissedTransactions is false for this test
    mockIsFeatureEnabled.mockImplementation((feature: string) => {
      if (feature === 'rerunMissedTransactions') return false;
      if (feature === 'dryRun' || feature === 'dryRunNewCategories') return false;
      return originalIsFeatureEnabled(feature);
    });

    // Act
    sut = new ActualAiService(
      transactionService,
      inMemoryApiService,
      notesMigrator,
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
    mockIsFeatureEnabled.mockImplementation((feature: string) => {
      if (feature === 'syncAccountsBeforeClassify') return true;
      if (feature === 'rerunMissedTransactions') return false;
      if (feature === 'dryRun' || feature === 'dryRunNewCategories') return false;
      return originalIsFeatureEnabled(feature);
    });

    // Act
    sut = new ActualAiService(
      transactionService,
      inMemoryApiService,
      notesMigrator,
    );
    await sut.classify();

    // Assert
    expect(inMemoryApiService.getWasBankSyncRan()).toBe(true);
  });

  // Add a new test for when rerunMissedTransactions is true
  it('It should process transaction with missed tag when rerunMissedTransactions is true', async () => {
    // Arrange
    const transaction = GivenActualData.createTransaction(
      '1',
      -123,
      'Carrefour 1234',
      'Carrefour XXXX1234567 822-307-2000 | #actual-ai-miss',
    );
    inMemoryApiService.setTransactions([transaction]);
    mockedLlmService.setGuess(GivenActualData.CATEGORY_GROCERIES);

    // Set rerunMissedTransactions to true for this test
    mockIsFeatureEnabled.mockImplementation((feature: string) => {
      if (feature === 'rerunMissedTransactions') return true;
      if (feature === 'dryRun' || feature === 'dryRunNewCategories') return false;
      return originalIsFeatureEnabled(feature);
    });

    // Act
    sut = new ActualAiService(
      transactionService,
      inMemoryApiService,
      notesMigrator,
    );
    await sut.classify();

    // Assert
    const updatedTransactions = await inMemoryApiService.getTransactions();
    expect(updatedTransactions[0].category).toBe(GivenActualData.CATEGORY_GROCERIES);
    expect(updatedTransactions[0].notes).toContain(GUESSED_TAG);
  });

  it('should create a new category and group when LLM suggests a new one', async () => {
    // Arrange
    const transaction = GivenActualData.createTransaction(
      'new-cat-txn',
      -50,
      'New Service Inc.',
      'Payment for new service',
    );
    inMemoryApiService.setTransactions([transaction]);

    const newCategorySuggestion: CategorySuggestion = {
      name: 'Digital Services',
      groupName: 'Tech Expenses',
      groupIsNew: true,
    };

    mockedLlmService.setUnifiedResponse({
      type: 'new',
      newCategory: newCategorySuggestion,
    });

    // Enable suggestNewCategories feature for this test
    mockIsFeatureEnabled.mockImplementation((feature: string) => {
      if (feature === 'suggestNewCategories') return true;
      if (feature === 'rerunMissedTransactions') return false;
      if (feature === 'dryRun' || feature === 'dryRunNewCategories') return false;
      return originalIsFeatureEnabled(feature);
    });

    const createGroupSpy = jest.spyOn(inMemoryApiService, 'createCategoryGroup');
    const createCategorySpy = jest.spyOn(inMemoryApiService, 'createCategory');

    sut = new ActualAiService(
      transactionService,
      inMemoryApiService,
      notesMigrator,
    );

    // Act
    await sut.classify();

    // Assert
    const updatedTransactions = await inMemoryApiService.getTransactions();
    // Explicitly type the spy results to avoid 'any' type issues
    const createGroupResult = await createGroupSpy.mock.results[0].value as string;
    const createCategoryResult = await createCategorySpy.mock.results[0].value as string;
    const newGroupId = createGroupResult;
    const newCategoryId = createCategoryResult;

    expect(createGroupSpy).toHaveBeenCalledWith(newCategorySuggestion.groupName);
    expect(createCategorySpy).toHaveBeenCalledWith(newCategorySuggestion.name, newGroupId);
    expect(updatedTransactions[0].category).toBe(newCategoryId);
    expect(updatedTransactions[0].notes).toContain(GUESSED_TAG);

    // Clean up spies
    createGroupSpy.mockRestore();
    createCategorySpy.mockRestore();
  });
});
