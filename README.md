# 🤖 Actual AI
<p>
    <a href="https://github.com/sakowicz/actual-ai">
        <img alt="GitHub Release" src="https://img.shields.io/github/v/release/sakowicz/actual-ai?label=GitHub">
    </a>
    <a href="https://hub.docker.com/r/sakowicz/actual-ai">
        <img alt="Docker Image Version" src="https://img.shields.io/docker/v/sakowicz/actual-ai?label=Docker%20Hub">
    </a>
</p>

This is a project that allows you to categorize uncategorized transactions for [Actual Budget](https://actualbudget.org/)
using [OpenAI](https://openai.com/api/pricing/) or OpenAI specification compatible API, like a self-hosted [Ollama](https://github.com/ollama/ollama) server.

## 🌟 Features

#### 📊 Classify transactions using OpenAI

The app sends requests to the OpenAI API to classify transactions based on their description, amount, and notes.

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
      - ACTUAL_SERVER_URL=http://actual_server:5006
      - ACTUAL_PASSWORD=your_actual_password
      - ACTUAL_BUDGET_ID=your_actual_budget_id # This is the ID from Settings → Show advanced settings → Sync ID
      - CLASSIFICATION_SCHEDULE_CRON=0 */4 * * * # How often to run classification.
      - CLASSIFY_ON_STARTUP=true # Whether to classify transactions on startup (don't wait for cron schedule)
      - SYNC_ACCOUNTS_BEFORE_CLASSIFY=false # Whether to sync accounts before classification
      - OPENAI_API_KEY=your_openai_api_key
#      - OPENAI_MODEL= # optional. required if you want to use a specific model, default is "gpt-3.5-turbo-instruct"
#      - OPENAI_BASE_URL= # optional. required if you don't want to use the OpenAI API but OpenAI compatible API
#      - ACTUAL_E2E_PASSWORD= # optional. required if you have E2E encryption
#      - NODE_TLS_REJECT_UNAUTHORIZED=0 # optional. required if you have trouble connecting to Actual server 
```

### 📝 Notes from the author

I'm not a Node developer.
I have no experience with AI or GitHub actions.
I've created this script to help categorise hundreds of transactions in my Actual Budget and decided to publish it.

Feel free to suggest changes or open a MR.
