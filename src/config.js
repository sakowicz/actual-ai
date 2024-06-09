require('dotenv').config();

module.exports = {
  serverURL: process.env.ACTUAL_SERVER_URL,
  password: process.env.ACTUAL_PASSWORD,
  budgetId: process.env.ACTUAL_BUDGET_ID,
  cronSchedule: process.env.CLASSIFICATION_SCHEDULE_CRON,
  classifyOnStartup: process.env.CLASSIFY_ON_STARTUP === 'true',
  syncAccountsBeforeClassify: process.env.SYNC_ACCOUNTS_BEFORE_CLASSIFY === 'true',
};
