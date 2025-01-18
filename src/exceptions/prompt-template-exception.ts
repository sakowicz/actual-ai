export default class PromptTemplateException extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PromptTemplateException';
  }
}
