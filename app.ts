import cron from 'node-cron';
import { cronSchedule, isFeatureEnabled } from './src/config';
import actualAi from './src/container';
import installProcessGuards from './src/utils/process-guards';

if (!isFeatureEnabled('classifyOnStartup') && !cron.validate(cronSchedule)) {
  console.error('classifyOnStartup not set or invalid cron schedule:', cronSchedule);
  process.exit(1);
}

installProcessGuards(cron.validate(cronSchedule));

if (cron.validate(cronSchedule)) {
  cron.schedule(cronSchedule, async () => {
    await actualAi.classify();
  });
}

console.log('Application started');
if (isFeatureEnabled('classifyOnStartup')) {
  (async () => {
    await actualAi.classify();
  })();
} else {
  console.log('Application started, waiting for cron schedule:', cronSchedule);
}
