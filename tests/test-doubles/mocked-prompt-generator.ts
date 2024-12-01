import { PromptGeneratorI } from '../../src/types';

export default class MockedPromptGenerator implements PromptGeneratorI {
  generate(): string {
    return 'mocked prompt';
  }
}
