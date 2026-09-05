import { formatError } from './error-utils';

/**
 * Keeps the scheduler alive when `@actual-app/api` rejects a promise we never get a handle on.
 *
 * A failed bank sync or budget download makes the API reject internally, and Node terminates the
 * process on an unhandled rejection. In a container that turns a temporary network failure into a
 * restart loop, so the schedule never recovers on its own even once the bank is reachable again.
 *
 * @param keepAlive true in cron mode, where a later run can still succeed. In run-once mode there
 * is nothing left to retry, so the failure is reported through a non-zero exit code instead.
 */
export default function installProcessGuards(keepAlive: boolean): void {
  process.on('unhandledRejection', (reason: unknown) => {
    console.error('Unhandled promise rejection:', formatError(reason));
    if (!keepAlive) {
      process.exitCode = 1;
    }
  });

  process.on('uncaughtException', (error: unknown) => {
    console.error('Uncaught exception:', formatError(error));
    if (!keepAlive) {
      process.exitCode = 1;
    }
  });
}
