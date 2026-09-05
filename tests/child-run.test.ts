import { EventEmitter } from 'events';
import { ChildProcess } from 'child_process';
import ChildRunner, { isRunOnceChild, RUN_ONCE_ENV } from '../src/utils/child-run';

function fakeChild(): ChildProcess {
  return new EventEmitter() as unknown as ChildProcess;
}

/** Hands out one fake child per call, so a test can drive each run's exit separately. */
function spawnQueue(children: ChildProcess[]): jest.Mock<ChildProcess, []> {
  let index = 0;
  return jest.fn<ChildProcess, []>(() => {
    const child = children[index];
    index += 1;
    return child;
  });
}

describe('ChildRunner', () => {
  beforeEach(() => {
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('starts a run per schedule once the previous one finished', () => {
    const children = [fakeChild(), fakeChild()];
    const spawn = spawnQueue(children);
    const runner = new ChildRunner(spawn);

    runner.start();
    children[0].emit('exit', 0, null);
    runner.start();

    expect(spawn).toHaveBeenCalledTimes(2);
  });

  test('skips a schedule while the previous run is still going', () => {
    const child = fakeChild();
    const spawn = spawnQueue([child]);
    const runner = new ChildRunner(spawn);

    runner.start();
    runner.start();

    expect(spawn).toHaveBeenCalledTimes(1);
    expect(console.log).toHaveBeenCalledWith(
      'Previous classification run is still in progress, skipping this schedule',
    );
  });

  test('reports a failed run and accepts the next schedule', () => {
    const children = [fakeChild(), fakeChild()];
    const spawn = spawnQueue(children);
    const runner = new ChildRunner(spawn);

    runner.start();
    children[0].emit('exit', 1, null);

    expect(console.error).toHaveBeenCalledWith('Classification run exited with code 1');

    runner.start();
    expect(spawn).toHaveBeenCalledTimes(2);
  });

  test('recovers when the child cannot be started at all', () => {
    const children = [fakeChild(), fakeChild()];
    const spawn = spawnQueue(children);
    const runner = new ChildRunner(spawn);

    runner.start();
    children[0].emit('error', new Error('spawn failed'));
    runner.start();

    expect(spawn).toHaveBeenCalledTimes(2);
    expect(console.error).toHaveBeenCalledWith('Failed to start classification run:', 'spawn failed');
  });
});

describe('isRunOnceChild', () => {
  test('detects the environment the scheduler sets on its children', () => {
    expect(isRunOnceChild({ [RUN_ONCE_ENV]: 'true' })).toBe(true);
    expect(isRunOnceChild({})).toBe(false);
  });
});
