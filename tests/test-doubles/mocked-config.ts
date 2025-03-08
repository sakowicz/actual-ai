// Mock implementation of config to disable dryRun for tests
const isFeatureEnabled = (feature: string): boolean => {
  if (feature === 'dryRun' || feature === 'dryRunNewCategories') {
    return false;
  }
  return true;
};

export default isFeatureEnabled;
