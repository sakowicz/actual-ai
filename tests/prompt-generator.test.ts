import { TransactionEntity } from '@actual-app/api/@types/loot-core/types/models';
import fs from 'fs';
import PromptGenerator from '../src/prompt-generator';
import GivenActualData from './test-doubles/given/given-actual-data';
import PromptTemplateException from '../src/exceptions/prompt-template-exception';

const promptTemplate = fs.readFileSync('./src/templates/prompt.hbs', 'utf8').trim();
const categorySuggestionTemplate = fs.readFileSync('./src/templates/category-suggestion.hbs', 'utf8').trim();
const similarRulesTemplate = fs.readFileSync('./src/templates/similar-rules.hbs', 'utf8').trim();

describe('LlmGenerator', () => {
  const expectedAirbnb = 'I want to categorize the given bank transaction into one of the following categories:\n'
    + 'GROUP: Usual Expenses (ID: "1")\n'
    + '* Groceries (ID: "ff7be77b-40f4-4e9d-aea4-be6b8c431281")\n'
    + '* Travel (ID: "541836f1-e756-4473-a5d0-6c1d3f06c7fa")\n'
    + 'GROUP: Income (ID: "2")\n'
    + '* Salary (ID: "123836f1-e756-4473-a5d0-6c1d3f06c7fa")\n\n'
    + 'Transaction details:\n'
    + '* Amount: 34169\n'
    + '* Type: Outcome\n'
    + '* Description: AIRBNB * XXXX1234567 822-307-2000\n'
    + '* Payee: Airbnb * XXXX1234567\n\n'
    + 'RESPOND ONLY WITH A CATEGORY ID from the list above. Do not write anything else.\n'
    + 'If you\'re not sure which category to use, respond with "uncategorized".';

  const expectedCarrefour = 'I want to categorize the given bank transaction into one of the following categories:\n'
    + 'GROUP: Usual Expenses (ID: "1")\n'
    + '* Groceries (ID: "ff7be77b-40f4-4e9d-aea4-be6b8c431281")\n'
    + '* Travel (ID: "541836f1-e756-4473-a5d0-6c1d3f06c7fa")\n'
    + 'GROUP: Income (ID: "2")\n'
    + '* Salary (ID: "123836f1-e756-4473-a5d0-6c1d3f06c7fa")\n\n'
    + 'Transaction details:\n'
    + '* Amount: 1000\n'
    + '* Type: Outcome\n'
    + '* Payee: Carrefour\n\n'
    + 'RESPOND ONLY WITH A CATEGORY ID from the list above. Do not write anything else.\n'
    + 'If you\'re not sure which category to use, respond with "uncategorized".';

  const expectedGoogle = 'I want to categorize the given bank transaction into one of the following categories:\n'
    + 'GROUP: Usual Expenses (ID: "1")\n'
    + '* Groceries (ID: "ff7be77b-40f4-4e9d-aea4-be6b8c431281")\n'
    + '* Travel (ID: "541836f1-e756-4473-a5d0-6c1d3f06c7fa")\n'
    + 'GROUP: Income (ID: "2")\n'
    + '* Salary (ID: "123836f1-e756-4473-a5d0-6c1d3f06c7fa")\n\n'
    + 'Transaction details:\n'
    + '* Amount: 2137420\n'
    + '* Type: Income\n'
    + '* Description: DESCRIPTION\n'
    + '* Payee: Google\n\n'
    + 'RESPOND ONLY WITH A CATEGORY ID from the list above. Do not write anything else.\n'
    + 'If you\'re not sure which category to use, respond with "uncategorized".';

  const promptSet: [TransactionEntity, string][] = [
    [
      GivenActualData.createTransaction(
        '1',
        -34169,
        'Airbnb * XXXX1234567',
        'AIRBNB * XXXX1234567 822-307-2000',
      ),
      expectedAirbnb,
    ], [
      GivenActualData.createTransaction(
        '1',
        -1000,
        'Carrefour 2137',
        '',
        GivenActualData.PAYEE_CARREFOUR,
      ),
      expectedCarrefour,
    ], [
      GivenActualData.createTransaction(
        '1',
        2137420,
        'Google Imported',
        'DESCRIPTION',
        GivenActualData.PAYEE_GOOGLE,
      ),
      expectedGoogle,
    ],
  ];

  it.each(promptSet)('should generate a prompt for categorizing transactions', (
    transaction: TransactionEntity,
    expectedPrompt: string,
  ) => {
    const categoryGroups = GivenActualData.createSampleCategoryGroups();

    const payees = GivenActualData.createSamplePayees();
    const promptGenerator = new PromptGenerator(promptTemplate, categorySuggestionTemplate);
    const prompt = promptGenerator.generate(categoryGroups, transaction, payees);

    expect(prompt).toEqual(expectedPrompt);
  });

  it('should throw exception on invalid prompt', () => {
    const categoryGroups = GivenActualData.createSampleCategoryGroups();

    const payees = GivenActualData.createSamplePayees();
    const transaction = GivenActualData.createTransaction('1', 1000, 'Carrefour 2137');
    const promptGenerator = new PromptGenerator('{{#each categories}}', categorySuggestionTemplate);
    const t = () => {
      promptGenerator.generate(categoryGroups, transaction, payees);
    };

    expect(t).toThrow(PromptTemplateException);
  });

  it('should generate a category suggestion prompt', () => {
    const categoryGroups = GivenActualData.createSampleCategoryGroups();
    const payees = GivenActualData.createSamplePayees();
    const transaction = GivenActualData.createTransaction(
      '1',
      -1000,
      'Carrefour 2137',
      '',
      GivenActualData.PAYEE_CARREFOUR,
    );

    const promptGenerator = new PromptGenerator(promptTemplate, categorySuggestionTemplate);
    const prompt = promptGenerator.generateCategorySuggestion(categoryGroups, transaction, payees);

    expect(prompt).toContain('I need to suggest a new category for a transaction');
    expect(prompt).toContain('* Payee: Carrefour');
    expect(prompt).toContain('* Amount: 1000');
    expect(prompt).toContain('* Type: Outcome');
    expect(prompt).toContain('RESPOND WITH A JSON OBJECT');
  });

  it('should throw exception on invalid category suggestion prompt', () => {
    const categoryGroups = GivenActualData.createSampleCategoryGroups();
    const payees = GivenActualData.createSamplePayees();
    const transaction = GivenActualData.createTransaction('1', 1000, 'Carrefour 2137');
    const promptGenerator = new PromptGenerator(promptTemplate, '{{#each invalidSyntax}}');

    const t = () => {
      promptGenerator.generateCategorySuggestion(categoryGroups, transaction, payees);
    };

    expect(t).toThrow(PromptTemplateException);
  });

  it('should generate a similar rules prompt', () => {
    const transaction = GivenActualData.createTransaction(
      '1',
      -1000,
      'Carrefour 2137',
      '',
      GivenActualData.PAYEE_CARREFOUR,
    );

    const rulesDescription = [
      {
        ruleName: 'Grocery Rule',
        conditions: 'payee contains "Carrefour"',
        categoryName: 'Groceries',
        categoryId: GivenActualData.CATEGORY_GROCERIES,
      },
      {
        ruleName: 'Travel Rule',
        conditions: 'payee contains "Airbnb"',
        categoryName: 'Travel',
        categoryId: GivenActualData.CATEGORY_TRAVEL,
      },
    ];

    const promptGenerator = new PromptGenerator(
      promptTemplate,
      categorySuggestionTemplate,
      similarRulesTemplate,
    );
    const prompt = promptGenerator.generateSimilarRulesPrompt(transaction, rulesDescription);

    expect(prompt).toContain('Transaction details:');
    expect(prompt).toContain('* Payee: Carrefour 2137');
    expect(prompt).toContain('* Amount: 1000');
    expect(prompt).toContain('* Type: Outcome');

    // Less strict checks that don't rely on exact formatting
    expect(prompt).toContain('Grocery Rule');
    expect(prompt).toContain('payee contains');
    expect(prompt).toContain('Carrefour');
    expect(prompt).toContain('Groceries');

    expect(prompt).toContain('Travel Rule');
    expect(prompt).toContain('Airbnb');
    expect(prompt).toContain('Travel');

    expect(prompt).toContain('Based on the transaction details');
    expect(prompt).toContain('If there\'s a match, return a JSON object');
  });

  it('should throw exception on invalid similar rules prompt', () => {
    const transaction = GivenActualData.createTransaction('1', 1000, 'Carrefour 2137');
    const rulesDescription = [
      {
        ruleName: 'Grocery Rule',
        conditions: 'payee contains "Carrefour"',
        categoryName: 'Groceries',
        categoryId: GivenActualData.CATEGORY_GROCERIES,
      },
    ];

    const promptGenerator = new PromptGenerator(
      promptTemplate,
      categorySuggestionTemplate,
      '{{#each invalidSyntax}}',
    );

    const t = () => {
      promptGenerator.generateSimilarRulesPrompt(transaction, rulesDescription);
    };

    expect(t).toThrow(PromptTemplateException);
  });
});
