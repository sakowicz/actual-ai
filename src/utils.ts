async function suppressConsoleLogsAsync(callback: any) {
  const originalConsoleLog = console.log;
  // eslint-disable-next-line func-names
  console.log = function () {};
  const result = await callback();
  console.log = originalConsoleLog;

  return result;
}

export default suppressConsoleLogsAsync;
