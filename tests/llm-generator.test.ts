import { APICategoryGroupEntity, APIPayeeEntity } from '@actual-app/api/@types/loot-core/server/api-models';
import { TransactionEntity } from '@actual-app/api/@types/loot-core/types/models';
import LlmGenerator from '../src/llm-generator';

describe('LlmGenerator', () => {
  const promptSet: [TransactionEntity, string][] = [
    [
      {
        id: '1',
        starting_balance_flag: false,
        imported_payee: 'Airbnb * XXXX1234567',
        amount: -34169,
        account: '1',
        date: '2021-01-01',
        notes: 'AIRBNB * XXXX1234567 822-307-2000',
      },
      'I want to categorize the given bank transactions into the following categories:\n'
      + '* Groceries (Usual Expenses) (ID: "ff7be77b-40f4-4e9d-aea4-be6b8c431281") \n'
      + '* Travel (Usual Expenses) (ID: "541836f1-e756-4473-a5d0-6c1d3f06c7fa") \n'
      + '* Salary (Income) (ID: "123836f1-e756-4473-a5d0-6c1d3f06c7fa") \n'
      + 'Please categorize the following transaction: \n'
      + '* Amount: 34169\n'
      + '* Type: Outcome\n'
      + '* Description: AIRBNB * XXXX1234567 822-307-2000\n'
      + '* Payee: Airbnb * XXXX1234567\n'
      + 'ANSWER BY A CATEGORY ID. DO NOT WRITE THE WHOLE SENTENCE. Do not guess, if you don\'t know the answer, return "idk".',
    ], [
      {
        id: '1',
        starting_balance_flag: false,
        imported_payee: 'Carrefour 2137',
        amount: -1000,
        account: '1',
        date: '2021-01-01',
        payee: '2',
      },
      'I want to categorize the given bank transactions into the following categories:\n'
      + '* Groceries (Usual Expenses) (ID: "ff7be77b-40f4-4e9d-aea4-be6b8c431281") \n'
      + '* Travel (Usual Expenses) (ID: "541836f1-e756-4473-a5d0-6c1d3f06c7fa") \n'
      + '* Salary (Income) (ID: "123836f1-e756-4473-a5d0-6c1d3f06c7fa") \n'
      + 'Please categorize the following transaction: \n'
      + '* Amount: 1000\n'
      + '* Type: Outcome\n'
      + '* Description: \n'
      + '* Payee: Carrefour\n'
      + '* Payee RAW: Carrefour 2137\n'
      + 'ANSWER BY A CATEGORY ID. DO NOT WRITE THE WHOLE SENTENCE. Do not guess, if you don\'t know the answer, return "idk".',
    ], [
      {
        id: '1',
        starting_balance_flag: false,
        imported_payee: 'Google',
        amount: 2137420,
        account: '1',
        date: '2021-01-01',
        payee: '3',
      },
      'I want to categorize the given bank transactions into the following categories:\n'
      + '* Groceries (Usual Expenses) (ID: "ff7be77b-40f4-4e9d-aea4-be6b8c431281") \n'
      + '* Travel (Usual Expenses) (ID: "541836f1-e756-4473-a5d0-6c1d3f06c7fa") \n'
      + '* Salary (Income) (ID: "123836f1-e756-4473-a5d0-6c1d3f06c7fa") \n'
      + 'Please categorize the following transaction: \n'
      + '* Amount: 2137420\n'
      + '* Type: Income\n'
      + '* Description: \n'
      + '* Payee: Google\n'
      + 'ANSWER BY A CATEGORY ID. DO NOT WRITE THE WHOLE SENTENCE. Do not guess, if you don\'t know the answer, return "idk".',
    ],
  ];

  it.each(promptSet)('should generate a prompt for categorizing transactions', (
    transaction: TransactionEntity,
    expectedPrompt: string,
  ) => {
    const categoryGroups: APICategoryGroupEntity[] = [
      {
        id: '1',
        name: 'Usual Expenses',
        categories: [
          { id: 'ff7be77b-40f4-4e9d-aea4-be6b8c431281', name: 'Groceries' },
          { id: '541836f1-e756-4473-a5d0-6c1d3f06c7fa', name: 'Travel' },
        ],
      }, {
        id: '2',
        name: 'Income',
        categories: [
          { id: '123836f1-e756-4473-a5d0-6c1d3f06c7fa', name: 'Salary' },
        ],
      },
    ];

    const payees: APIPayeeEntity[] = [
      { id: '1', name: 'Airbnb * XXXX1234567' },
      { id: '2', name: 'Carrefour' },
    ];
    const prompt = LlmGenerator.generatePrompt(categoryGroups, transaction, payees);

    expect(prompt).toEqual(expectedPrompt);
  });
});
