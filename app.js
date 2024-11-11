const cron = require('node-cron');
const { cronSchedule, classifyOnStartup } = require('./src/config');
const { actualAi } = require('./src/container');

if (!cron.validate(cronSchedule)) {
  console.error('Invalid cron schedule:', cronSchedule);
  process.exit(1);
}

cron.schedule(cronSchedule, async () => {
  await actualAi.classify();
});

console.log('Application started');
if (classifyOnStartup === true) {
  (async () => {
    await actualAi.classify();
  })();
} else {
  console.log('Application started, waiting for cron schedule:', cronSchedule);
}
