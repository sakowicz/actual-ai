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
      CLASSIFY_ON_STARTUP: true # Whether to classify transactions on startup (don't wait for cron schedule)
      SYNC_ACCOUNTS_BEFORE_CLASSIFY: false # Whether to sync accounts before classification
      LLM_PROVIDER: openai # Can be "openai", "anthropic", "google-generative-ai" or "ollama"
#      OPENAI_API_KEY:  # optional. required if you want to use the OpenAI API
#      OPENAI_MODEL:  # optional. required if you want to use a specific model, default is "gpt-4-turbo"
#      OPENAI_BASE_URL:  # optional. required if you don't want to use the OpenAI API but OpenAI compatible API, ex: "http://ollama:11424/v1
#      ANTHROPIC_API_KEY:  # optional. required if you want to use the Anthropic API
#      ANTHROPIC_MODEL:  # optional. required if you want to use a specific model, default is "claude-3-5-sonnet-latest"
#      ANTHROPIC_BASE_URL:  # optional. default: "https://api.anthropic.com/v1
#      GOOGLE_GENERATIVE_AI_API_KEY:  # optional. required if you want to use the Google Generative AI API
#      GOOGLE_GENERATIVE_AI_MODEL:  # optional. required if you want to use a specific model, default is "gemini-1.5-flash"
#      GOOGLE_GENERATIVE_AI_BASE_URL:  # optional. default: "https://generativelanguage.googleapis.com"
#      OLLAMA_MODEL: phi3.5 # optional. required if you want to use a Ollama specific model, default is "phi3.5"
#      OLLAMA_BASE_URL:  # optional. required for ollama provider
#      ACTUAL_E2E_PASSWORD:  # optional. required if you have E2E encryption
#      NODE_TLS_REJECT_UNAUTHORIZED: 0 # optional. required if you have trouble connecting to Actual server 
#      NOT_GUESSED_TAG=#actual-ai-miss
#      GUESSED_TAG=#actual-ai
#      PROMPT_TEMPLATE: >
#        I want to categorize the given bank transactions into the following categories:
#        {{#each categoryGroups}}
#        {{#each categories}}
#        * {{name}} ({{../name}}) (ID: "{{id}}")
#        {{/each}}
#        {{/each}}
#        Please categorize the following transaction:
#        * Amount: {{amount}}
#        * Type: {{type}}
#        {{#if description}}
#        * Description: {{description}}
#        {{/if}}
#        {{#if payee}}
#        * Payee: {{payee}}
#        {{^}}
#        * Payee: {{importedPayee}}
#        {{/if}}
#        ANSWER BY A CATEGORY ID. Do not guess, if you don't know the answer, return "uncategorized".
```

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
