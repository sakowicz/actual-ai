import MockedLlmService from './mocked-llm-service';
import GivenActualData from './given/given-actual-data';

describe('MockedLlmService', () => {
  let mockedLlmService: MockedLlmService;

  beforeEach(() => {
    mockedLlmService = new MockedLlmService();
  });

  it('should return the default response when no guess is set', async () => {
    const response = await mockedLlmService.ask('test prompt');
    expect(response).toEqual({
      type: 'existing',
      categoryId: 'uncategorized',
    });
  });

  it('should set the response when setGuess is called with a UUID', async () => {
    const categoryId = GivenActualData.CATEGORY_GROCERIES;
    mockedLlmService.setGuess(categoryId);

    const response = await mockedLlmService.ask('test prompt');
    expect(response).toEqual({
      type: 'existing',
      categoryId,
    });
  });

  it('should set the response when setGuess is called with a category name', async () => {
    mockedLlmService.setGuess('Groceries');

    const response = await mockedLlmService.ask('test prompt');
    expect(response).toEqual({
      type: 'existing',
      categoryId: GivenActualData.CATEGORY_GROCERIES,
    });
  });
});
