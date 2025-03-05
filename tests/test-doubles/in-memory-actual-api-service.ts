import {
  APIAccountEntity,
  APICategoryEntity,
  APICategoryGroupEntity,
  APIPayeeEntity,
} from '@actual-app/api/@types/loot-core/server/api-models';
import { RuleEntity, TransactionEntity } from '@actual-app/api/@types/loot-core/types/models';
import { ActualApiServiceI } from '../../src/types';

export default class InMemoryActualApiService implements ActualApiServiceI {
  private categoryGroups: APICategoryGroupEntity[] = [];

  private categories: (APICategoryEntity | APICategoryGroupEntity)[] = [];

  private payees: APIPayeeEntity[] = [];

  private accounts: APIAccountEntity[] = [];

  private transactions: TransactionEntity[] = [];

  private wasBankSyncRan = false;

  async initializeApi(): Promise<void> {
    // Initialize the API (mock implementation)
  }

  async shutdownApi(): Promise<void> {
    // Shutdown the API (mock implementation)
  }

  async getCategoryGroups(): Promise<APICategoryGroupEntity[]> {
    return Promise.resolve(this.categoryGroups);
  }

  setCategoryGroups(categoryGroups: APICategoryGroupEntity[]): void {
    this.categoryGroups = categoryGroups;
  }

  async getCategories(): Promise<(APICategoryEntity | APICategoryGroupEntity)[]> {
    return Promise.resolve(this.categories);
  }

  setCategories(categories: (APICategoryEntity | APICategoryGroupEntity)[]): void {
    this.categories = categories;
  }

  async getAccounts(): Promise<APIAccountEntity[]> {
    return Promise.resolve(this.accounts);
  }

  setAccounts(accounts: APIAccountEntity[]): void {
    this.accounts = accounts;
  }

  async getPayees(): Promise<APIPayeeEntity[]> {
    return Promise.resolve(this.payees);
  }

  setPayees(payees: APIPayeeEntity[]): void {
    this.payees = payees;
  }

  async getTransactions(): Promise<TransactionEntity[]> {
    return Promise.resolve(this.transactions);
  }

  setTransactions(transactions: TransactionEntity[]): void {
    this.transactions = transactions;
  }

  async updateTransactionNotes(id: string, notes: string): Promise<void> {
    return new Promise((resolve) => {
      const transaction = this.transactions.find((t) => t.id === id);

      if (!transaction) {
        throw new Error(`Transaction with id ${id} not found`);
      }
      transaction.notes = notes;
      resolve();
    });
  }

  async updateTransactionNotesAndCategory(
    id: string,
    notes: string,
    categoryId: string,
  ): Promise<void> {
    return new Promise((resolve) => {
      const transaction = this.transactions.find((t) => t.id === id);
      if (!transaction) {
        throw new Error(`Transaction with id ${id} not found`);
      }
      transaction.notes = notes;
      transaction.category = categoryId;
      resolve();
    });
  }

  async runBankSync(): Promise<void> {
    this.wasBankSyncRan = true;
    return Promise.resolve();
  }

  public getWasBankSyncRan(): boolean {
    return this.wasBankSyncRan;
  }

  async createCategory(name: string, groupId: string): Promise<string> {
    const categoryId = `cat-${Date.now()}`;
    const newCategory: APICategoryEntity = {
      id: categoryId,
      name,
      group_id: groupId,
      is_income: false,
    };

    this.categories.push(newCategory);

    // Update the category group to include this category
    const groupIndex = this.categoryGroups.findIndex((group) => group.id === groupId);
    if (groupIndex >= 0) {
      if (!this.categoryGroups[groupIndex].categories) {
        this.categoryGroups[groupIndex].categories = [];
      }
      this.categoryGroups[groupIndex].categories.push(newCategory);
    }

    return Promise.resolve(categoryId);
  }

  async createCategoryGroup(name: string): Promise<string> {
    const groupId = `group-${Date.now()}`;
    const newGroup: APICategoryGroupEntity = {
      id: groupId,
      name,
      is_income: false,
      categories: [],
    };

    this.categoryGroups.push(newGroup);
    this.categories.push(newGroup);

    return Promise.resolve(groupId);
  }

  async updateCategoryGroup(id: string, name: string): Promise<void> {
    const groupIndex = this.categoryGroups.findIndex((group) => group.id === id);
    if (groupIndex >= 0) {
      this.categoryGroups[groupIndex].name = name;
    }

    // Also update in the categories array
    const categoryIndex = this.categories.findIndex((cat) => cat.id === id);
    if (categoryIndex >= 0) {
      this.categories[categoryIndex].name = name;
    }

    return Promise.resolve();
  }

  async getRules(): Promise<RuleEntity[]> {
    return Promise.resolve([]);
  }

  async getPayeeRules(_payeeId: string): Promise<RuleEntity[]> {
    return Promise.resolve([]);
  }
}
