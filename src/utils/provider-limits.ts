export interface ProviderLimits {
  tokensPerMinute: number;
  requestsPerMinute: number;
}

// Default conservative limits - these should be updated based on user's plan
export const PROVIDER_LIMITS: Record<string, ProviderLimits> = {
  openai: {
    tokensPerMinute: 60000,
    requestsPerMinute: 500,
  },
  anthropic: {
    tokensPerMinute: 100000,
    requestsPerMinute: 400,
  },
  google: {
    tokensPerMinute: 60000,
    requestsPerMinute: 300,
  },
  groq: {
    tokensPerMinute: 6000,
    requestsPerMinute: 100,
  },
  ollama: {
    tokensPerMinute: 10000, // This is a local model, so limits depend on your hardware
    requestsPerMinute: 50,
  },
};

export default PROVIDER_LIMITS;
