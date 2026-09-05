import os from 'os';
import path from 'path';

export const LOCK_STALE_MS = 2 * 60 * 1000;

export const LOCK_HEARTBEAT_MS = 30 * 1000;

const activeLockPaths = new Set<string>();

interface LockPayload {
  pid?: number;
  hostname?: string;
  startedAt?: string;
  heartbeatAt?: string;
}

function isErrnoException(error: unknown): error is Error & { code?: string } {
  return error instanceof Error;
}

function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error: unknown) {
    if (isErrnoException(error) && error.code === 'ESRCH') {
      return false;
    }
    return true;
  }
}

class DataDirLock {
  private readonly fs: typeof import('fs');

  private readonly dataDir: string;

  private readonly lockPath: string;

  private lockFd: number | null = null;

  private heartbeatTimer: NodeJS.Timeout | null = null;

  constructor(fs: typeof import('fs'), dataDir: string) {
    this.fs = fs;
    this.dataDir = dataDir;
    this.lockPath = path.join(dataDir, '.actual-ai.lock');
  }

  public acquire(): void {
    if (!this.fs.existsSync(this.dataDir)) {
      this.fs.mkdirSync(this.dataDir, { recursive: true });
    }

    if (activeLockPaths.has(this.lockPath)) {
      throw new Error(
        `Another actual-ai run appears active (pid=${process.pid}). `
        + `Refusing to use shared dataDir: ${this.dataDir}`,
      );
    }

    if (this.fs.existsSync(this.lockPath)) {
      const holder = this.readLock();
      if (holder !== null && this.isHeldByAnotherRun(holder)) {
        throw new Error(
          `Another actual-ai run appears active (pid=${holder.pid ?? 'unknown'}). `
          + `Refusing to use shared dataDir: ${this.dataDir}`,
        );
      }
      // Stale lock (crashed run, reused PID, or our own leaked lock); remove it.
      this.fs.unlinkSync(this.lockPath);
    }

    // 'wx' creates exclusively; throws if it exists.
    this.lockFd = this.fs.openSync(this.lockPath, 'wx');
    activeLockPaths.add(this.lockPath);
    this.writePayload(new Date().toISOString());
    this.startHeartbeat();
  }

  public release(): void {
    activeLockPaths.delete(this.lockPath);
    try {
      if (this.heartbeatTimer !== null) {
        clearInterval(this.heartbeatTimer);
        this.heartbeatTimer = null;
      }
      if (this.lockFd !== null) {
        this.fs.closeSync(this.lockFd);
        this.lockFd = null;
      }
      if (this.fs.existsSync(this.lockPath)) {
        this.fs.unlinkSync(this.lockPath);
      }
    } catch {
      // Best-effort cleanup.
    }
  }

  private readLock(): LockPayload | null {
    try {
      const raw = this.fs.readFileSync(this.lockPath, 'utf8');
      return JSON.parse(raw) as LockPayload;
    } catch {
      // Unparseable or unreadable lock; treat as stale.
      return null;
    }
  }

  private isHeldByAnotherRun(holder: LockPayload): boolean {
    if (typeof holder.pid !== 'number') {
      return false;
    }
    if (holder.pid === process.pid) {
      // Our PID, but no live holder in this process (checked in `acquire`), so this is a lock
      // leaked by an earlier failed run. Reclaim it instead of blocking every future run.
      return false;
    }
    if (holder.hostname !== undefined && holder.hostname !== os.hostname()) {
      // Written by a different machine/container instance that can no longer be running here.
      return false;
    }
    if (this.isStale(holder)) {
      return false;
    }
    return isProcessAlive(holder.pid);
  }

  private isStale(holder: LockPayload): boolean {
    const beat = holder.heartbeatAt ?? holder.startedAt;
    if (beat === undefined) {
      // Written by an older version without a heartbeat; fall back to the PID check alone.
      return false;
    }
    const beatAt = Date.parse(beat);
    if (Number.isNaN(beatAt)) {
      return true;
    }
    return Date.now() - beatAt > LOCK_STALE_MS;
  }

  private startHeartbeat(): void {
    const startedAt = new Date().toISOString();
    this.heartbeatTimer = setInterval(() => {
      try {
        this.writePayload(startedAt);
      } catch {
        // Best-effort; a failed heartbeat only risks another run reclaiming the lock.
      }
    }, LOCK_HEARTBEAT_MS);
    this.heartbeatTimer.unref();
  }

  private writePayload(startedAt: string): void {
    if (this.lockFd === null) {
      return;
    }
    const payload = JSON.stringify({
      pid: process.pid,
      hostname: os.hostname(),
      startedAt,
      heartbeatAt: new Date().toISOString(),
    });
    this.fs.ftruncateSync(this.lockFd, 0);
    this.fs.writeSync(this.lockFd, payload, 0);
  }
}

export default DataDirLock;
