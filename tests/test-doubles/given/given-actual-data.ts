import {
  APIAccountEntity,
  APICategoryEntity,
  APICategoryGroupEntity,
  APIPayeeEntity,
} from '@actual-app/api/@types/loot-core/server/api-models';
import { TransactionEntity, RuleEntity } from '@actual-app/api/@types/loot-core/types/models';

export default class GivenActualData {
  public static CATEGORY_GROCERIES = 'ff7be77b-40f4-4e9d-aea4-be6b8c431281';

  public static CATEGORY_TRAVEL = '541836f1-e756-4473-a5d0-6c1d3f06c7fa';

  public static CATEGORY_SALARY = '123836f1-e756-4473-a5d0-6c1d3f06c7fa';

  public static ACCOUNT_OFF_BUDGET = '321836f1-e756-4473-a5d0-6c1d3f06c7fa';

  public static ACCOUNT_MAIN = '333836f1-e756-4473-a5d0-6c1d3f06c7fa';

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

  public static createAccount(
    id: string,
    name: string,
    isOffBudget: boolean,
    isClosed: boolean,
  ): APIAccountEntity {
    return {
      id, name, offbudget: isOffBudget, closed: isClosed,
    };
  }

  public static createTransaction(
    id: string,
    amount: number,
    importedPayee: string,
    notes = '',
    payee: undefined | string = undefined,
    account = GivenActualData.ACCOUNT_MAIN,
    date = '2021-01-01',
    isParent = false,
    category: undefined | string = undefined,
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
      category,
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

  public static createSampleAccounts(): APIAccountEntity[] {
    return [
      this.createAccount(GivenActualData.ACCOUNT_MAIN, 'Main Account', false, false),
      this.createAccount(GivenActualData.ACCOUNT_OFF_BUDGET, 'Off Budget Account', true, false),
    ];
  }

  static createSampleRules(): RuleEntity[] {
    return [
      {
        id: '879da987-9879-8798-7987-987987987987',
        stage: null,
        conditionsOp: 'and',
        conditions: [],
        actions: [{
          op: 'set',
          field: 'category',
          value: this.CATEGORY_GROCERIES,
          type: 'id',
        }],
      },
      {
        id: '879da987-9879-8798-7987-987987987988',
        stage: null,
        conditionsOp: 'and',
        conditions: [],
        actions: [{
          op: 'set',
          field: 'category',
          value: this.CATEGORY_TRAVEL,
          type: 'id',
        }],
      },
    ];
  }
}
