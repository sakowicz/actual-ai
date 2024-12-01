import {
  APICategoryEntity,
  APICategoryGroupEntity,
  APIPayeeEntity,
} from '@actual-app/api/@types/loot-core/server/api-models';
import { TransactionEntity } from '@actual-app/api/@types/loot-core/types/models';
import { ActualApiServiceI } from '../../src/types';

export default class InMemoryActualApiService implements ActualApiServiceI {
  private categoryGroups: APICategoryGroupEntity[] = [];

  private categories: (APICategoryEntity | APICategoryGroupEntity)[] = [];

  private payees: APIPayeeEntity[] = [];

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
}
