const actualApi = require('@actual-app/api');
const fs = require('fs');

const dataDir = '/tmp/actual-ai/';
const {
  serverURL, password, budgetId, e2ePassword,
} = require('./config');

async function initializeApi() {
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir);
  }
  await actualApi.init({ dataDir, serverURL, password });
  try {
    if (e2ePassword) {
      await actualApi.downloadBudget(budgetId, {
        password: e2ePassword,
      });
    } else {
      await actualApi.downloadBudget(budgetId);
    }
    console.log('Budget downloaded');
  } catch (error) {
    console.error('Failed to download budget:', error.message);
    throw new Error('Budget download failed');
  }
}
async function shutdownApi() {
  await actualApi.shutdown();
}

module.exports = {
  initializeApi,
  shutdownApi,
  actualApi,
};
