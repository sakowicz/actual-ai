module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  collectCoverageFrom: ['src/**/*.ts', 'app.ts'],
  // The compiled output carries a copy of every test; running those too doubles the suite
  // and re-runs whatever was built last, not what is in the working tree.
  testPathIgnorePatterns: ['/node_modules/', '/dist/'],
};
