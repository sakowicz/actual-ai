# 🤖 Actual AI

<p>
    <a href="https://github.com/sakowicz/actual-ai">
        <img alt="GitHub Release" src="https://img.shields.io/github/v/release/sakowicz/actual-ai?label=GitHub">
    </a>
    <a href="https://hub.docker.com/r/sakowicz/actual-ai">
        <img alt="Docker Image Version" src="https://img.shields.io/docker/v/sakowicz/actual-ai?label=Docker%20Hub">
    </a>
    <a href="https://codecov.io/github/sakowicz/actual-ai" >
        <img alt="Test Coverage" src="https://codecov.io/github/sakowicz/actual-ai/graph/badge.svg?token=7ZLJUN61QE"/>
    </a>
</p>

This is a project that allows you to categorize uncategorized transactions
for [Actual Budget](https://actualbudget.org/)
using [OpenAI](https://openai.com/api/pricing/), [Anthropic](https://www.anthropic.com/pricing#anthropic-api), [Google Generative AI](https://ai.google/discover/generativeai/), [Ollama](https://github.com/ollama/ollama)
or any other compatible API.

## 🌟 Features

#### 📊 Classify transactions using LLM

The app sends requests to the LLM to classify transactions based on their description, amount, and notes.

#### 🔄 Sync accounts before classification

#### 🕒 Classify transactions on a cron schedule

#### ❌ When a transaction cannot be classified, it is marked in Notes as "not guessed," and it will not be classified again.

#### ✅ Every guessed transaction is marked as guessed in notes, so you can review the classification.

#### 🌱 Suggest and create new categories for transactions that don't fit existing ones

When enabled, the LLM can suggest entirely new categories for transactions it cannot classify, and optionally create them automatically.

#### 🌐 Web search for unfamiliar merchants

Using the ValueSerp API, the system can search the web for information about unfamiliar merchants to help the LLM make better categorization decisions.

#### 🔎 Free web search alternative

A self-hosted alternative to ValueSerp that uses free public search API (DuckDuckGo) to search for merchant information without requiring an API key.

#### 🔄 Re-run missed transactions

Re-process transactions previously marked as unclassified.

## 🚀 Usage

Sample `docker-compose.yml` file:

```yaml
services:
  actual_server:
    image: docker.io/actualbudget/actual-server:latest
    ports:
      - '5006:5006'
    volumes:
      - ./actual-data:/data
    restart: unless-stopped

  actual-ai:
    image: docker.io/sakowicz/actual-ai:latest
    restart: unless-stopped
    environment:
      ACTUAL_SERVER_URL: http://actual_server:5006
      ACTUAL_PASSWORD: your_actual_password
      ACTUAL_BUDGET_ID: your_actual_budget_id # This is the ID from Settings → Show advanced settings → Sync ID
      CLASSIFICATION_SCHEDULE_CRON: 0 */4 * * * # How often to run classification.
      LLM_PROVIDER: openai # Can be "openai", "anthropic", "google-generative-ai", "ollama" or "groq"
      FEATURES: '["classifyOnStartup", "syncAccountsBeforeClassify", "freeWebSearch", "suggestNewCategories"]'
#      VALUESERP_API_KEY: your_valueserp_api_key # API key for ValueSerp, required if webSearch tool is enabled
#      OPENAI_API_KEY:  # optional. required if you want to use the OpenAI API
#      OPENAI_MODEL:  # optional. required if you want to use a specific model, default is "gpt-4o-mini"
#      OPENAI_BASE_URL:  # optional. required if you don't want to use the OpenAI API but OpenAI compatible API, ex: "http://ollama:11424/v1
#      ANTHROPIC_API_KEY:  # optional. required if you want to use the Anthropic API
#      ANTHROPIC_MODEL:  # optional. required if you want to use a specific model, default is "claude-3-5-sonnet-latest"
#      ANTHROPIC_BASE_URL:  # optional. default: "https://api.anthropic.com/v1
#      GOOGLE_GENERATIVE_AI_API_KEY:  # optional. required if you want to use the Google Generative AI API
#      GOOGLE_GENERATIVE_AI_MODEL:  # optional. required if you want to use a specific model, default is "gemini-1.5-flash"
#      GOOGLE_GENERATIVE_AI_BASE_URL:  # optional. default: "https://generativelanguage.googleapis.com"
#      OLLAMA_MODEL=llama3.1 optional. required if you want to use an Ollama specific model, default is "phi3.5"
#      OLLAMA_BASE_URL=http://localhost:11434/api # optional. required for ollama provider
#      GROQ_API_KEY:  # optional. required if you want to use the Groq API
#      GROQ_MODEL:  # optional. required if you want to use a specific model, default is "mixtral-8x7b-32768"
#      GROQ_BASE_URL:  # optional. default: "https://api.groq.com/openai/v1"
#      ACTUAL_E2E_PASSWORD:  # optional. required if you have E2E encryption
#      NODE_TLS_REJECT_UNAUTHORIZED: 0 # optional. required if you have trouble connecting to Actual server 
#      NOT_GUESSED_TAG=#actual-ai-miss
#      GUESSED_TAG=#actual-ai
```

## Feature Configuration

You can configure features in using the FEATURES array (recommended):

The `FEATURES` environment variable accepts a JSON array of feature names to enable:

```
FEATURES='["freeWebSearch", "suggestNewCategories", "classifyOnStartup", "syncAccountsBeforeClassify"]'
```

Available features:
- `webSearch` - Enable web search for merchant information
- `freeWebSearch` - Enable free web search for merchant information (self-hosted alternative to ValueSerp)
- `suggestNewCategories` - Allow suggesting new categories for transactions
- `classifyOnStartup` - Run classification when the application starts
- `syncAccountsBeforeClassify` - Sync accounts before running classification
- `dryRun` - Run in dry run mode (enabled by default)
- `dryRunNewCategories` - Only log suggested categories without creating them (enabled by default)
- `rerunMissedTransactions` - Re-process transactions previously marked as unclassified

## Customizing the Prompt

To create a custom prompt, modify the `PROMPT_TEMPLATE` environment variable to include or exclude variables as needed.
Ensure that the [Handlebars](https://handlebarsjs.com/) syntax is correctly used to handle conditional rendering and
loops.

### Variables

1. `categoryGroups`: An array of category group objects. Each category group contains an array of categories.
    - `categoryGroup` is object with the following properties:
        - `id`: The ID of the category group.
        - `name`: The name of the category group.
        - `categories`: An array of category objects.
            - `category` is an object with the following properties:
                - `id`: The ID of the category.
                - `name`: The name of the category.
2. `amount`: The absolute value of the transaction amount.
3. `type`: The type of transaction, either 'Income' or 'Outcome'.
4. `description`: The notes or description of the transaction. This is taken from `transaction.notes`.
5. `payee`: The name of the payee associated with the transaction. This is found by matching the payee ID in the
   transaction with the payee list.
6. `importedPayee`: The imported payee name from the transaction. This is taken from `transaction.imported_payee`.
7. `date`: The date of the transaction. This is taken from `transaction.date`.
8. `cleared`: A boolean indicating if the transaction is cleared. This is taken from `transaction.cleared`.
9. `reconciled`: A boolean indicating if the transaction is reconciled. This is taken from `transaction.reconciled`.

## New Category Suggestions

When `suggestNewCategories` feature is enabled, the system will:

1. First try to classify transactions using existing categories
2. For transactions that can't be classified, request a new category suggestion from the LLM
3. Check if similar categories already exist
4. If in dry run mode (`dryRunNewCategories` is enabled), just log the suggestions
5. If not in dry run mode, create the new categories and assign transactions to them

This feature is particularly useful when you have transactions that don't fit your current category structure and you want the LLM to help expand your categories intelligently.

## Tools Integration

The system supports various tools that can be enabled to enhance the LLM's capabilities:

1. Enable tools by including them in the `FEATURES` array or by setting `ENABLED_TOOLS`
2. Provide any required API keys for the tools you want to use

Currently supported tools:

### webSearch

The webSearch tool uses the ValueSerp API to search for information about merchants that the LLM might not be familiar with, providing additional context for categorization decisions.

To use this tool:
1. Include `webSearch` in your `FEATURES` array or `ENABLED_TOOLS` list
2. Provide your ValueSerp API key as `VALUESERP_API_KEY`

This is especially helpful for:
- New or uncommon merchants
- Merchants with ambiguous names
- Specialized services that might be difficult to categorize without additional information

The search results are included in the prompts sent to the LLM, helping it make more accurate category assignments or suggestions.

## Dry Run Mode

The `dryRun` feature is enabled by default. In this mode:
- No transactions will be modified
- No categories will be created
- All proposed changes will be logged to console
- System will show what would happen with real execution

To perform actual changes:
1. Remove `dryRun` from your FEATURES array
2. Ensure `suggestNewCategories` is enabled if you want new category creation
3. Run the classification process

Dry run messages will show:
- Which transactions would be categorized
- Which rules would be applied
- What new categories would be created
- How many transactions would be affected by each change
