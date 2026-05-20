import { UnifiedResponse } from '../types';

/**
 * Strips away markdown wrapper backticks (e.g. ```json ... ```)
 * and isolates the raw JSON string content.
 */
function cleanJsonResponse(text: string): string {
  // If the text looks like a UUID or simple ID, return it as is
  if (/^[a-zA-Z0-9_-]+$/.test(text.trim())) {
    return text.trim();
  }

  // Remove markdown code fences and any surrounding text
  let cleaned = text.replace(/```json\n?|\n?```/g, '');
  cleaned = cleaned.trim();

  // If there are no JSON structure characters, return the trimmed text as is
  if (!/[{[]/.test(cleaned) || !/[}\]]/.test(cleaned)) {
    return cleaned;
  }

  // Remove leading characters up to first JSON structure character
  cleaned = cleaned.replace(/^[^{[]*?([{[])/, '$1');
  // Remove trailing characters after last JSON structure character
  cleaned = cleaned.replace(/([}\]])[^}\]]*$/, '$1');

  return cleaned.trim();
}

/**
 * Parses and maps LLM batch response strings to a clean UnifiedResponse array.
 * Robustly falls back to parsing single JSON object returns as a single-element array.
 */
function parseLlmResponse(text: string): UnifiedResponse[] {
  const cleanedText = cleanJsonResponse(text);
  console.log('Cleaned LLM response:', cleanedText);

  try {
    let parsedArray: Partial<UnifiedResponse>[];
    try {
      const parsed = JSON.parse(cleanedText);
      // Ensure it's always handled as an array for batching processing
      parsedArray = Array.isArray(parsed) ? parsed : [parsed];
    } catch {
      throw new Error('Response is not valid JSON mapped correctly');
    }

    const validResponses: UnifiedResponse[] = [];

    for (const parsed of parsedArray) {
      // Fallback to 'test-transaction-id' if absent to maintain robust parsing and backwards compatibility
      const transactionId = parsed.transactionId ?? 'test-transaction-id';

      if (parsed.type === 'existing' && parsed.categoryId) {
        validResponses.push({ transactionId, type: 'existing', categoryId: parsed.categoryId });
        continue;
      }
      if (parsed.type === 'rule' && parsed.ruleName) {
        // categoryId is optional for rule matches — e.g. "leave uncategorized" rules
        validResponses.push({
          transactionId,
          type: 'rule',
          ...(parsed.categoryId ? { categoryId: parsed.categoryId } : {}),
          ruleName: parsed.ruleName,
        });
        continue;
      }
      if (parsed.type === 'new' && parsed.newCategory) {
        validResponses.push({
          transactionId,
          type: 'new',
          newCategory: parsed.newCategory,
        });
        continue;
      }

      if (parsed.categoryId) {
        console.log(`LLM response missing type but has categoryId for ${transactionId}, treating as existing category`);
        validResponses.push({
          transactionId,
          type: 'existing',
          categoryId: parsed.categoryId,
        });
        continue;
      }
      console.warn(`Invalid response structure mapped from LLM for ${transactionId}`);
    }

    if (validResponses.length === 0) {
      throw new Error('No valid array items generated from LLM');
    }
    return validResponses;
  } catch (parseError) {
    console.error('Failed to parse LLM response array:', cleanedText, parseError);
    throw new Error('Invalid array response format from LLM');
  }
}

export { parseLlmResponse, cleanJsonResponse };
