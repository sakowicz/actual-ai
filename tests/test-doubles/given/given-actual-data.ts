import {
  APICategoryEntity,
  APICategoryGroupEntity,
  APIPayeeEntity,
} from '@actual-app/api/@types/loot-core/server/api-models';
import { TransactionEntity } from '@actual-app/api/@types/loot-core/types/models';

export default class GivenActualData {
  public static CATEGORY_GROCERIES = 'ff7be77b-40f4-4e9d-aea4-be6b8c431281';

  public static CATEGORY_TRAVEL = '541836f1-e756-4473-a5d0-6c1d3f06c7fa';

  public static CATEGORY_SALARY = '123836f1-e756-4473-a5d0-6c1d3f06c7fa';

  public static PAYEE_AIRBNB = '1';

  public static PAYEE_CARREFOUR = '2';

  public static PAYEE_GOOGLE = '3';

  public static createCategoryGroup(
    id: string,
    name: string,
    categories: APICategoryEntity[],
  ): APICategoryGroupEntity {
    return { id, name, categories };
  }

  public static createCategory(id: string, name: string, groupId: string): APICategoryEntity {
    return { id, name, group_id: groupId };
  }

  public static createPayee(id: string, name: string): APIPayeeEntity {
    return { id, name };
  }

  public static createTransaction(
    id: string,
    amount: number,
    importedPayee: string,
    notes = '',
    payee: undefined | string = undefined,
    account = '1',
    date = '2021-01-01',
    isParent = false,
  ): TransactionEntity {
    return {
      id,
      amount,
      starting_balance_flag: false,
      imported_payee: importedPayee,
      account,
      date,
      notes,
      payee,
      is_parent: isParent,
    };
  }

  public static createSampleCategoryGroups(): APICategoryGroupEntity[] {
    return [
      this.createCategoryGroup('1', 'Usual Expenses', [
        this.createCategory(GivenActualData.CATEGORY_GROCERIES, 'Groceries', '1'),
        this.createCategory(GivenActualData.CATEGORY_TRAVEL, 'Travel', '1'),
      ]),
      this.createCategoryGroup('2', 'Income', [
        this.createCategory(GivenActualData.CATEGORY_SALARY, 'Salary', '2'),
      ]),
    ];
  }

  public static createSampleCategories(): APICategoryEntity[] {
    return [
      this.createCategory(GivenActualData.CATEGORY_GROCERIES, 'Groceries', '1'),
      this.createCategory(GivenActualData.CATEGORY_TRAVEL, 'Travel', '1'),
      this.createCategory(GivenActualData.CATEGORY_SALARY, 'Salary', '2'),
    ];
  }

  public static createSamplePayees(): APIPayeeEntity[] {
    return [
      this.createPayee(GivenActualData.PAYEE_AIRBNB, 'Airbnb'),
      this.createPayee(GivenActualData.PAYEE_CARREFOUR, 'Carrefour'),
      this.createPayee(GivenActualData.PAYEE_GOOGLE, 'Google'),
    ];
  }

  public static createSampleTransactions(): TransactionEntity[] {
    return [
      this.createTransaction('1', 100, 'Carrefour 32321', 'Transaction without category'),
      this.createTransaction('2', 100, 'Carrefour 32321', 'Transaction with Groceries category', GivenActualData.CATEGORY_GROCERIES),
      this.createTransaction('3', 100, 'Airbnb * XXXX1234567', 'Transaction with Travel category', undefined, GivenActualData.PAYEE_AIRBNB),
      this.createTransaction('4', -30000, ' 3', 'Transaction with salary income', GivenActualData.CATEGORY_SALARY, GivenActualData.PAYEE_GOOGLE),
      this.createTransaction('5', -30000, '1', 'Transaction with income without category', undefined, GivenActualData.PAYEE_GOOGLE),
    ];
  }
}
