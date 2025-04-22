import { TransactionEntity, RuleEntity } from '@actual-app/api/@types/loot-core/types/models';
import type { APICategoryGroupEntity } from '@actual-app/api/@types/loot-core/server/api-models';
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
    expect(prompt).toContain('1. Unnamed rule → unknown');
    expect(prompt).toContain('2. Unnamed rule → unknown');
    expect(prompt).toContain('Conditions:');

    // Check for transaction details
    expect(prompt).toContain('Transaction details:');
    expect(prompt).toContain('* Amount: 1000');
    expect(prompt).toContain('* Type: Outcome');
    expect(prompt).toContain('* Date: 2021-01-01');
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

    it('should include web search tool message when freeWebSearch is enabled', () => {
      jest.spyOn(config, 'isToolEnabled').mockImplementation((tool) => tool === 'freeWebSearch');

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

    it('should not include web search tool message when both are disabled', () => {
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
