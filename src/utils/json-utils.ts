import { UnifiedResponse } from '../types';

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

// Models sometimes prepend prose reasoning to the JSON object — and when the
// prompt contains bracketed note tags like "[enricher]", the prose echoes them,
// so cleanJsonResponse's "first structure character" cut lands inside the prose
// instead of the JSON. Recover by scanning for the last balanced {...} block
// that parses. Braces inside JSON strings can break the depth count; then the
// parse fails and the scan moves on to an earlier candidate.
function extractLastJsonObject(text: string): Partial<UnifiedResponse> | null {
  for (let start = text.lastIndexOf('{'); start !== -1; start = text.lastIndexOf('{', start - 1)) {
    let depth = 0;
    for (let i = start; i < text.length; i += 1) {
      if (text[i] === '{') depth += 1;
      if (text[i] === '}') {
        depth -= 1;
        if (depth === 0) {
          try {
            return JSON.parse(text.slice(start, i + 1)) as Partial<UnifiedResponse>;
          } catch {
            break;
          }
        }
      }
    }
  }
  return null;
}

function parseLlmResponse(text: string): UnifiedResponse {
  const cleanedText = cleanJsonResponse(text);
  console.log('Cleaned LLM response:', cleanedText);

  try {
    let parsed: Partial<UnifiedResponse>;
    try {
      parsed = JSON.parse(cleanedText) as Partial<UnifiedResponse>;
    } catch {
      // If not valid JSON, check if it's a simple ID
      const trimmedText = cleanedText.trim().replace(/^"|"$/g, '');

      if (/^[a-zA-Z0-9_-]+$/.test(trimmedText)) {
        console.log(`LLM returned simple ID: "${trimmedText}"`);
        return {
          type: 'existing',
          categoryId: trimmedText,
        };
      }

      const extracted = extractLastJsonObject(text);
      if (extracted === null) {
        throw new Error('Response is neither valid JSON nor simple ID');
      }
      console.log('Recovered trailing JSON object from prose LLM response');
      parsed = extracted;
    }

    if (parsed.type === 'existing' && parsed.categoryId) {
      return { type: 'existing', categoryId: parsed.categoryId };
    }
    if (parsed.type === 'rule' && parsed.ruleName) {
      // categoryId is optional — a rule that says "leave uncategorized"
      // matches with no category assignment.
      return {
        type: 'rule',
        ...(parsed.categoryId ? { categoryId: parsed.categoryId } : {}),
        ruleName: parsed.ruleName,
      };
    }
    if (parsed.type === 'new' && parsed.newCategory) {
      return {
        type: 'new',
        newCategory: parsed.newCategory,
      };
    }

    // If the response doesn't match expected format but has a categoryId,
    // default to treating it as an existing category
    if (parsed.categoryId) {
      console.log('LLM response missing type but has categoryId, treating as existing category');
      return {
        type: 'existing',
        categoryId: parsed.categoryId,
      };
    }
    if (parsed && typeof parsed === 'string') {
      return {
        type: 'existing',
        categoryId: parsed,
      };
    }

    console.error('Invalid response structure from LLM:', parsed);
    throw new Error('Invalid response format from LLM');
  } catch (parseError) {
    console.error('Failed to parse LLM response:', cleanedText, parseError);
    throw new Error('Invalid response format from LLM');
  }
}

export { parseLlmResponse, cleanJsonResponse };
