interface WaitOptions {
  attempts?: number;
  delayMs?: number;
  fetchImpl?: (url: URL) => Promise<{ ok: boolean }>;
  sleep?: (ms: number) => Promise<void>;
}

const defaultSleep = (ms: number) => new Promise<void>((resolve) => {
  setTimeout(resolve, ms);
});

/**
 * Waits until the Actual server answers on /health.
 *
 * A container that starts together with the server, for example after a reboot with `docker run`
 * and a restart policy, otherwise fails its startup classification with "network-failure" and
 * waits for the next scheduled run. Resolves true once the server is up and false after the last
 * attempt; the caller runs either way, so a server that never comes up still reports its error.
 */
export default async function waitForServer(serverURL: string, {
  attempts = 12,
  delayMs = 10_000,
  fetchImpl = fetch,
  sleep = defaultSleep,
}: WaitOptions = {}): Promise<boolean> {
  let healthURL: URL;
  try {
    healthURL = new URL('health', serverURL.endsWith('/') ? serverURL : `${serverURL}/`);
  } catch {
    return false;
  }

  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      const response = await fetchImpl(healthURL);
      if (response.ok) {
        if (attempt > 1) {
          console.log('Actual server is up');
        }
        return true;
      }
    } catch {
      // Not reachable yet: try again after the delay.
    }
    if (attempt === 1) {
      console.log(`Waiting for the Actual server at ${healthURL.href}`);
    }
    if (attempt < attempts) {
      await sleep(delayMs);
    }
  }
  console.warn(`Actual server did not answer after ${attempts} attempts; running anyway`);
  return false;
}
