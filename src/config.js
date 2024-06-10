require('dotenv').config();

module.exports = {
  serverURL: process.env.ACTUAL_SERVER_URL,
  password: process.env.ACTUAL_PASSWORD,
  budgetId: process.env.ACTUAL_BUDGET_ID,
  e2ePassword: process.env.ACTUAL_E2E_PASSWORD,
  cronSchedule: process.env.CLASSIFICATION_SCHEDULE_CRON,
  classifyOnStartup: process.env.CLASSIFY_ON_STARTUP === 'true',
  syncAccountsBeforeClassify: process.env.SYNC_ACCOUNTS_BEFORE_CLASSIFY === 'true',
  model: process.env.OPENAI_MODEL || 'gpt-3.5-turbo-instruct',
};
