import { LlmServiceI, UnifiedResponse } from '../../src/types';
import GivenActualData from './given/given-actual-data';

export default class MockedLlmService implements LlmServiceI {
  private response: UnifiedResponse = {
    type: 'existing',
    categoryId: 'uncategorized',
  };

  async ask(_prompt: string, _categoryIds?: string[]): Promise<UnifiedResponse> {
    return Promise.resolve(this.response);
  }

  // For backward compatibility in tests
  setGuess(categoryIdOrName: string): void {
    const uuidMatch = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i.exec(categoryIdOrName);
    const foundUUID = uuidMatch ? uuidMatch[0] : null;

    if (foundUUID) {
      this.response = {
        type: 'existing',
        categoryId: foundUUID,
      };
    } else {
      // Expand category mapping to include all sample categories
      const categoryMap: Record<string, string> = {
        Groceries: GivenActualData.CATEGORY_GROCERIES,
        Travel: GivenActualData.CATEGORY_TRAVEL,
        Salary: GivenActualData.CATEGORY_SALARY,
        Insurance: '5c2a6627-f8fa-4f7a-8781-4b039ff133cd',
        Repairs: '8955100f-5dc3-42ff-ab22-030136149a20',
        'Shopping & Clothing': '05ba8139-b5f0-4b51-8892-d046527ff6c2',
        Subscriptions: '3712d83e-3771-4b77-9059-53601b0b33bc',
        Utilities: 'c1277b57-39ac-4757-bb50-16a3290e2612',
        'Car Payment': 'b6874e94-82ae-4737-bbb4-a0ae28c17624',
        'Gas & Parking': '29bc9256-7151-4b1d-987c-069bc26e0454',
        'Drugs & Other Meds': '1602d1ec-ceee-47fa-b144-abca8021e177',
      };

      this.response = {
        type: 'existing',
        categoryId: categoryMap[categoryIdOrName] || 'uncategorized',
      };
    }
  }
}
