const cron = require('node-cron');
const { initializeApi, shutdownApi } = require('./src/actual-api');
const { processTransactions } = require('./src/transaction-service');
const { cronSchedule, classifyOnStartup } = require('./src/config');

if (!cron.validate(cronSchedule)) {
  console.error('Invalid cron schedule:', cronSchedule);
  process.exit(1);
}

async function classify() {
  console.log('Starting classification process');
  await initializeApi();
  await processTransactions();
  await shutdownApi();
}

cron.schedule(cronSchedule, async () => {
  try {
    await classify();
  } catch (error) {
    console.error('An error occurred:', error);
  }
});
if (classifyOnStartup === true) {
  console.log('Application started');
  (async () => {
    await classify();
  })();
} else {
  console.log('Application started, waiting for cron schedule:', cronSchedule);
}
