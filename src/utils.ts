async function suppressConsoleLogsAsync(callback: () => Promise<void>) {
  const originalConsoleLog = console.log;
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  console.log = () => {}; // Empty arrow function
  try {
    return await callback();
  } finally {
    console.log = originalConsoleLog;
  }
}

export default suppressConsoleLogsAsync;
