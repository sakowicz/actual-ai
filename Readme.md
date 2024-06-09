# actual-ai

This is a project allowing you to categorize uncategorized transaction for [Actual Budget](https://actualbudget.org/) using OpenAI.

### Usage

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
    volumes:
      - ./actual-ai-cache:/tmp/actual-ai/
    environment:
      - OPENAI_API_KEY=your_openai_api_key
      - ACTUAL_SERVER_URL=http://actual_server:5006
      - ACTUAL_PASSWORD=your_actual_password
      - ACTUAL_BUDGET_ID=your_actual_budget_id # This is the ID from Settings → Show advanced settings → Sync ID
      - CLASSIFICATION_SCHEDULE_CRON="0 */4 * * *" # How often to run classification.
      - CLASSIFY_ON_STARTUP=true # Whether to classify transactions on startup (don't wait for cron schedule)
      - SYNC_ACCOUNTS_BEFORE_CLASSIFY=true # Whether to sync accounts before classification
#      - ACTUAL_E2E_PASSWORD= # optional. required if you have E2E encryption
```

### Notes from the author

I'm not a Node developer.
I have no experience with AI or GitHub actions.
I've created this script to help categorise hundreds of transactions in my Actual Budget and decided to publish it.

Feel free to suggest changes or open a MR.
