const actualApi = require('@actual-app/api');
const fs = require('fs');

const dataDir = '/tmp/budgets';
const { serverURL, password, budgetId } = require('./config');

async function initializeApi() {
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir);
  }
  await actualApi.init({ dataDir, serverURL, password });
  await actualApi.downloadBudget(budgetId);
}

async function shutdownApi() {
  await actualApi.shutdown();
}

module.exports = {
  initializeApi,
  shutdownApi,
  actualApi,
};
