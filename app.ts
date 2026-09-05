import cron from 'node-cron';
import { cronSchedule, isFeatureEnabled } from './src/config';
import actualAi from './src/container';
import installProcessGuards from './src/utils/process-guards';
import ChildRunner, { isRunOnceChild } from './src/utils/child-run';

if (isRunOnceChild()) {
  // Spawned by the scheduler below for a single classification; the process exits afterwards.
  installProcessGuards(false);
  void actualAi.classify();
} else {
  if (!isFeatureEnabled('classifyOnStartup') && !cron.validate(cronSchedule)) {
    console.error('classifyOnStartup not set or invalid cron schedule:', cronSchedule);
    process.exit(1);
  }

  const isScheduled = cron.validate(cronSchedule);
  installProcessGuards(isScheduled);

  if (isScheduled) {
    // Scheduled runs go through a child process so a long-lived container keeps importing.
    const runner = new ChildRunner();
    cron.schedule(cronSchedule, () => {
      runner.start();
    });

    console.log('Application started');
    if (isFeatureEnabled('classifyOnStartup')) {
      runner.start();
    } else {
      console.log('Application started, waiting for cron schedule:', cronSchedule);
    }
  } else {
    // Without a schedule the process classifies once and exits, so it always has fresh state.
    console.log('Application started');
    void actualAi.classify();
  }
}
