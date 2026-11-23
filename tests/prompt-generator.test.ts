import { TransactionEntity, RuleEntity } from '@actual-app/core/src/types/models';
import type { APICategoryGroupEntity } from '@actual-app/core/src/server/api-models';
import fs from 'fs';
import PromptGenerator from '../src/prompt-generator';
import GivenActualData from './test-doubles/given/given-actual-data';
import PromptTemplateException from '../src/exceptions/prompt-template-exception';
import handlebars from '../src/handlebars-helpers';
import * as config from '../src/config';

// Mock the isToolEnabled function
jest.spyOn(config, 'isToolEnabled').mockReturnValue(false);

describe('PromptGenerator', () => {
  const promptTemplate = fs.readFileSync('./src/templates/prompt.hbs', 'utf8').trim();

  const promptSet: [TransactionEntity][] = [
    [
      GivenActualData.createTransaction(
        '1',
        -34169,
        'Airbnb * XXXX1234567',
        'AIRBNB * XXXX1234567 822-307-2000',
        undefined,
        undefined,
        '2021-01-01',
      ),
    ],
    [
      GivenActualData.createTransaction(
        '2',
        -1626,
        'Steam Purc',
        'Steam Purc   16.26_V #actual-ai-miss',
        undefined,
        undefined,
        '2025-02-18',
      ),
    ],
  ];

  // Helper function to safely create template data
  const loadAndRenderTemplate = (
    templateContent: string,
    transaction: TransactionEntity,
    categoryGroups: APICategoryGroupEntity[],
  ): string => {
    const template = handlebars.compile(templateContent);
    const payees = GivenActualData.createSamplePayees();

    // Create a type-safe copy of category groups with only required properties
    const safeCategoryGroups = categoryGroups.map((group) => {
      // Extract only properties we know exist in APICategoryGroupEntity
      const safeGroup: APICategoryGroupEntity = {
        id: group.id,
        name: group.name,
        is_income: group.is_income,
        categories: [],
      };

      // Type-safe mapping of categories
      const categories = (group.categories ?? []).map((category) => ({
        id: category.id,
        name: category.name,
        group_id: category.group_id,
        is_income: category.is_income,
      }));

      safeGroup.categories = categories;
      return safeGroup;
    });

    return template({
      categoryGroups: safeCategoryGroups,
      amount: Math.abs(transaction.amount),
      type: transaction.amount > 0 ? 'Income' : 'Outcome',
      description: transaction.notes ?? '',
      payee: payees.find((p) => p.id === transaction.payee)?.name ?? '',
      importedPayee: transaction.imported_payee ?? '',
      date: transaction.date ?? '',
      cleared: transaction.cleared ?? false,
      reconciled: transaction.reconciled ?? false,
      hasWebSearchTool: false,
      rules: [],
    });
  };

  it.each(promptSet)('should generate prompts in both modern and legacy formats', (
    transaction: TransactionEntity,
  ) => {
    const categoryGroups = GivenActualData.createSampleCategoryGroups();
    const payees = GivenActualData.createSamplePayees();

    // Modern format test
    const modernTemplate = fs.readFileSync('./src/templates/prompt.hbs', 'utf8').trim();
    const modernPromptGenerator = new PromptGenerator(modernTemplate);
    const generatedModern = modernPromptGenerator.generate(categoryGroups, transaction, payees, []);
    const expectedModern = loadAndRenderTemplate(modernTemplate, transaction, categoryGroups);
    expect(generatedModern.trim()).toEqual(expectedModern.trim());

    // Legacy format test
    const legacyTemplate = `
I want to categorize the given bank transactions into the following categories:
{{#each categoryGroups}}
{{#each categories}}
* {{name}} ({{../name}}) (ID: "{{id}}")
{{/each}}
{{/each}}
Please categorize the following transaction:
* Amount: {{amount}}
* Type: {{type}}
{{#if description}}
* Description: {{description}}
{{/if}}
{{#if payee}}
* Payee: {{payee}}
{{^}}
* Payee: {{importedPayee}}
{{/if}}
ANSWER BY A CATEGORY ID - DO NOT CREATE ENTIRE SENTENCE - DO NOT WRITE CATEGORY NAME, JUST AN ID. Do not guess, if you don't know the answer, return "uncategorized".`.trim();

    const legacyPromptGenerator = new PromptGenerator(legacyTemplate);
    const generatedLegacy = legacyPromptGenerator.generate(categoryGroups, transaction, payees, []);
    const expectedLegacy = loadAndRenderTemplate(legacyTemplate, transaction, categoryGroups);
    expect(generatedLegacy.trim()).toEqual(expectedLegacy.trim());
  });

  it('should throw exception on invalid prompt', () => {
    const categoryGroups = GivenActualData.createSampleCategoryGroups();
    const payees = GivenActualData.createSamplePayees();
    const transaction = GivenActualData.createTransaction('1', 1000, 'Carrefour 2137');
    const promptGenerator = new PromptGenerator('{{#each categories}}');
    const t = () => {
      promptGenerator.generate(categoryGroups, transaction, payees, []);
    };

    expect(t).toThrow(PromptTemplateException);
  });

  it('should include rules in modern format when provided', () => {
    const transaction = GivenActualData.createTransaction(
      '1',
      -1000,
      'Carrefour 2137',
      '',
      GivenActualData.PAYEE_CARREFOUR,
      undefined,
      '2021-01-01',
    );

    const rules: RuleEntity[] = GivenActualData.createSampleRules();
    const categoryGroups = GivenActualData.createSampleCategoryGroups();
    const payees = GivenActualData.createSamplePayees();

    const promptGenerator = new PromptGenerator(promptTemplate);
    const prompt = promptGenerator.generate(categoryGroups, transaction, payees, rules);

    // Check for rule-specific content
    expect(prompt).toContain('Existing Rules:');
    expect(prompt).toContain('1. Rule 1 → Groceries');
    expect(prompt).toContain('2. Rule 2 → Travel');
    expect(prompt).toContain('Conditions:');

    // Check for transaction details
    expect(prompt).toContain('Transaction details:');
    expect(prompt).toContain('* Amount: 10.00');
    expect(prompt).toContain('* Type: Outcome');
    expect(prompt).toContain('* Date: 2021-01-01');
  });

  it('lists category ids but not group ids, so only category ids can be answered', () => {
    const transaction = GivenActualData.createTransaction('1', -1000, 'Carrefour 2137');
    const categoryGroups = GivenActualData.createSampleCategoryGroups();
    const payees = GivenActualData.createSamplePayees();

    const prompt = new PromptGenerator(promptTemplate)
      .generate(categoryGroups, transaction, payees, []);

    categoryGroups.forEach((group) => {
      expect(prompt).toContain(`GROUP: ${group.name}`);
      expect(prompt).not.toContain(`"${group.id}"`);
      (group.categories ?? []).forEach((category) => {
        expect(prompt).toContain(`* ${category.name} (ID: "${category.id}")`);
      });
    });
  });

  it('should show amounts as money, also in amount rule conditions', () => {
    const transaction = GivenActualData.createTransaction(
      '1',
      -1234,
      'Carrefour 2137',
      '',
      GivenActualData.PAYEE_CARREFOUR,
      undefined,
      '2021-01-01',
    );

    // Actual stores amounts in cents, and an "is between" range as { num1, num2 },
    // which the shim's string type does not cover.
    const rules: RuleEntity[] = [
      {
        id: '879da987-9879-8798-7987-987987987989',
        stage: null,
        conditionsOp: 'and',
        conditions: [
          {
            field: 'amount',
            op: 'is',
            value: '-1234',
            type: 'number',
          },
          {
            field: 'amount',
            op: 'isbetween',
            value: { num1: -2000, num2: -1000 } as unknown as string,
            type: 'number',
          },
        ],
        actions: [{
          op: 'set',
          field: 'category',
          value: GivenActualData.CATEGORY_GROCERIES,
          type: 'id',
        }],
      },
    ];

    const promptGenerator = new PromptGenerator(promptTemplate);
    const prompt = promptGenerator.generate(
      GivenActualData.createSampleCategoryGroups(),
      transaction,
      GivenActualData.createSamplePayees(),
      rules,
    );

    expect(prompt).toContain('* Amount: 12.34');
    expect(prompt).toContain('Conditions: amount is -12.34, amount isbetween -20.00 and -10.00');

    // With the budget's currency, the amounts carry its symbol.
    const usdPrompt = promptGenerator.generate(
      GivenActualData.createSampleCategoryGroups(),
      transaction,
      GivenActualData.createSamplePayees(),
      rules,
      'USD',
    );

    expect(usdPrompt).toContain('* Amount: $12.34');
    expect(usdPrompt).toContain('Conditions: amount is -$12.34, amount isbetween -$20.00 and -$10.00');
  });

  it.each([
    { currencyCode: 'USD', amount: -1234, shown: '$12.34' },
    { currencyCode: 'EUR', amount: -1234, shown: '€12.34' },
    // Actual stores hundredths for every currency, also for one without decimals.
    { currencyCode: 'JPY', amount: -123400, shown: '¥1,234' },
    { currencyCode: '', amount: -1234, shown: '12.34' },
    { currencyCode: 'not a code', amount: -1234, shown: '12.34' },
  ])('should show $amount in the budget currency "$currencyCode" as $shown', ({ currencyCode, amount, shown }) => {
    const transaction = GivenActualData.createTransaction('1', amount, 'Carrefour 2137');

    const prompt = new PromptGenerator(promptTemplate).generate(
      GivenActualData.createSampleCategoryGroups(),
      transaction,
      GivenActualData.createSamplePayees(),
      [],
      currencyCode,
    );

    const amountLine = prompt.split(/\r?\n/).find((line) => line.startsWith('* Amount:'));
    expect(amountLine).toBe(`* Amount: ${shown}`);
  });

  describe('web search tool', () => {
    afterEach(() => {
      jest.clearAllMocks();
    });

    it('should include web search tool message when webSearch is enabled', () => {
      jest.spyOn(config, 'isToolEnabled').mockImplementation((tool) => tool === 'webSearch');

      const transaction = GivenActualData.createTransaction(
        '1',
        -1000,
        'Carrefour 2137',
        '',
        GivenActualData.PAYEE_CARREFOUR,
        undefined,
        '2021-01-01',
      );

      const categoryGroups = GivenActualData.createSampleCategoryGroups();
      const payees = GivenActualData.createSamplePayees();

      const promptGenerator = new PromptGenerator(promptTemplate);
      const prompt = promptGenerator.generate(categoryGroups, transaction, payees, []);

      expect(prompt).toContain('You can use the web search tool to find more information about the transaction.');
    });

    it('should not include web search tool message when the tool is disabled', () => {
      jest.spyOn(config, 'isToolEnabled').mockImplementation((_tool) => false);

      const transaction = GivenActualData.createTransaction(
        '1',
        -1000,
        'Carrefour 2137',
        '',
        GivenActualData.PAYEE_CARREFOUR,
        undefined,
        '2021-01-01',
      );

      const categoryGroups = GivenActualData.createSampleCategoryGroups();
      const payees = GivenActualData.createSamplePayees();

      const promptGenerator = new PromptGenerator(promptTemplate);
      const prompt = promptGenerator.generate(categoryGroups, transaction, payees, []);

      expect(prompt).not.toContain('You can use the web search tool to find more information about the transaction.');
    });
  });
});
