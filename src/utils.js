async function suppressConsoleLogsAsync(callback) {
  const originalConsoleLog = console.log;
  // eslint-disable-next-line func-names
  console.log = function () {};
  const result = await callback();
  console.log = originalConsoleLog;

  return result;
}

module.exports = {
  suppressConsoleLogsAsync,
};
