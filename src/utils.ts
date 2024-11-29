async function suppressConsoleLogsAsync(callback: () => Promise<void>) {
  const originalConsoleLog = console.log;
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  console.log = () => {}; // Empty arrow function
  const result = await callback();
  console.log = originalConsoleLog;

  return result;
}

export default suppressConsoleLogsAsync;
