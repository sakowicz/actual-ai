import { TransactionEntity } from '@actual-app/api/@types/loot-core/types/models';
import fs from 'fs';
import PromptGenerator from '../src/prompt-generator';
import GivenActualData from './test-doubles/given/given-actual-data';
import PromptTemplateException from '../src/exceptions/prompt-template-exception';

const promptTemplate = fs.readFileSync('./src/templates/prompt.hbs', 'utf8').trim();

describe('LlmGenerator', () => {
  const promptSet: [TransactionEntity, string, string][] = [
    [
      GivenActualData.createTransaction(
        '1',
        -34169,
        'Airbnb * XXXX1234567',
        'AIRBNB * XXXX1234567 822-307-2000',
      ),
      'I want to categorize the given bank transactions into the following categories:'
      + '\n* Groceries (Usual Expenses) (ID: "ff7be77b-40f4-4e9d-aea4-be6b8c431281")'
      + '\n* Travel (Usual Expenses) (ID: "541836f1-e756-4473-a5d0-6c1d3f06c7fa")'
      + '\n* Salary (Income) (ID: "123836f1-e756-4473-a5d0-6c1d3f06c7fa")'
      + '\nPlease categorize the following transaction:'
      + '\n* Amount: 34169'
      + '\n* Type: Outcome'
      + '\n* Description: AIRBNB * XXXX1234567 822-307-2000'
      + '\n* Payee: Airbnb * XXXX1234567'
      + '\nANSWER BY A CATEGORY ID. DO NOT WRITE THE WHOLE SENTENCE. Do not guess, if you don\'t know the answer, return "idk".',
      promptTemplate,
    ], [
      GivenActualData.createTransaction(
        '1',
        -1000,
        'Carrefour 2137',
        '',
        GivenActualData.PAYEE_CARREFOUR,
      ),
      'I want to categorize the given bank transactions into the following categories:'
      + '\n* Groceries (Usual Expenses) (ID: "ff7be77b-40f4-4e9d-aea4-be6b8c431281")'
      + '\n* Travel (Usual Expenses) (ID: "541836f1-e756-4473-a5d0-6c1d3f06c7fa")'
      + '\n* Salary (Income) (ID: "123836f1-e756-4473-a5d0-6c1d3f06c7fa")'
      + '\nPlease categorize the following transaction:'
      + '\n* Amount: 1000'
      + '\n* Type: Outcome'
      + '\n* Payee: Carrefour'
      + '\nANSWER BY A CATEGORY ID. DO NOT WRITE THE WHOLE SENTENCE. Do not guess, if you don\'t know the answer, return "idk".',
      promptTemplate,
    ], [
      GivenActualData.createTransaction(
        '1',
        2137420,
        'Google Imported',
        'DESCRIPTION',
        GivenActualData.PAYEE_GOOGLE,
      ),
      'I want to categorize the given bank transactions into the following categories:'
      + '\n* Groceries (Usual Expenses) (ID: "ff7be77b-40f4-4e9d-aea4-be6b8c431281")'
      + '\n* Travel (Usual Expenses) (ID: "541836f1-e756-4473-a5d0-6c1d3f06c7fa")'
      + '\n* Salary (Income) (ID: "123836f1-e756-4473-a5d0-6c1d3f06c7fa")'
      + '\nPlease categorize the following transaction:'
      + '\n* Amount: 2137420'
      + '\n* Type: Income'
      + '\n* Description: DESCRIPTION'
      + '\n* Payee: Google'
      + '\nANSWER BY A CATEGORY ID. DO NOT WRITE THE WHOLE SENTENCE. Do not guess, if you don\'t know the answer, return "idk".',
      promptTemplate,
    ],
  ];

  it.each(promptSet)('should generate a prompt for categorizing transactions', (
    transaction: TransactionEntity,
    expectedPrompt: string,
  ) => {
    const categoryGroups = GivenActualData.createSampleCategoryGroups();

    const payees = GivenActualData.createSamplePayees();
    const promptGenerator = new PromptGenerator(promptTemplate);
    const prompt = promptGenerator.generate(categoryGroups, transaction, payees);

    expect(prompt).toEqual(expectedPrompt);
  });

  it('should throw exception on invalid prompt', () => {
    const categoryGroups = GivenActualData.createSampleCategoryGroups();

    const payees = GivenActualData.createSamplePayees();
    const transaction = GivenActualData.createTransaction('1', 1000, 'Carrefour 2137');
    const promptGenerator = new PromptGenerator('{{#each categories}}');
    const t = () => {
      promptGenerator.generate(categoryGroups, transaction, payees);
    };

    expect(t).toThrow(PromptTemplateException);
  });
});
