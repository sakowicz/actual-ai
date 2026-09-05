import { ChildProcess, fork } from 'child_process';

export const RUN_ONCE_ENV = 'ACTUAL_AI_RUN_ONCE';

export function isRunOnceChild(env: NodeJS.ProcessEnv = process.env): boolean {
  return env[RUN_ONCE_ENV] === 'true';
}

function forkRunOnceChild(): ChildProcess {
  return fork(process.argv[1], [], {
    env: { ...process.env, [RUN_ONCE_ENV]: 'true' },
    stdio: 'inherit',
  });
}

/**
 * Runs each scheduled classification in a child process.
 *
 * `@actual-app/api` keeps its state in module-level singletons that `init()` / `shutdown()` do not
 * fully reset. In a container that stays up for weeks, that state drifts until incremental sync
 * keeps reporting zero new messages and imports quietly stop, with a restart being the only cure.
 * A fresh child per run gets fresh module state, while the container itself stays up.
 */
export default class ChildRunner {
  private readonly spawn: () => ChildProcess;

  private active: ChildProcess | null = null;

  constructor(spawn: () => ChildProcess = forkRunOnceChild) {
    this.spawn = spawn;
  }

  /**
   * Ends the current run. Without this a container stop leaves the child orphaned, still holding
   * the dataDir lock, which blocks every run started after the container comes back.
   */
  public stop(signal: NodeJS.Signals = 'SIGTERM'): void {
    this.active?.kill(signal);
  }

  public start(): void {
    if (this.active !== null) {
      console.log('Previous classification run is still in progress, skipping this schedule');
      return;
    }

    const child = this.spawn();
    this.active = child;

    child.on('exit', (code, signal) => {
      this.active = null;
      if (code !== 0 && code !== null) {
        console.error(`Classification run exited with code ${code}`);
      } else if (signal !== null) {
        console.error(`Classification run was terminated by ${signal}`);
      }
    });

    child.on('error', (error) => {
      this.active = null;
      console.error('Failed to start classification run:', error.message);
    });
  }
}
