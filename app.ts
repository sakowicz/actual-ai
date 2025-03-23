import cron from 'node-cron';
import { cronSchedule, isFeatureEnabled } from './src/config';
import actualAi from './src/container';

if (!cron.validate(cronSchedule)) {
  console.error('Invalid cron schedule:', cronSchedule);
  process.exit(1);
}

cron.schedule(cronSchedule, async () => {
  await actualAi.classify();
});

console.log('Application started');
if (isFeatureEnabled('classifyOnStartup')) {
  (async () => {
    await actualAi.classify();
  })();
} else {
  console.log('Application started, waiting for cron schedule:', cronSchedule);
}
