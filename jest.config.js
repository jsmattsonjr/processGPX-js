export default {
  testEnvironment: 'node',
  testMatch: ['**/__tests__/**/*.test.js'],
  coverageDirectory: 'coverage',
  collectCoverageFrom: [
    'js/process-gpx.js',
    'process-cli.js',
    '!**/*.test.js',
    '!**/node_modules/**'
  ],
  coverageReporters: ['text', 'lcov', 'html'],
  coverageThreshold: {
    global: {
      branches: 20,
      functions: 20,
      lines: 20,
      statements: 20
    }
  },
  testTimeout: 180000, // 3 minutes for fuzz tests
  transform: {}
};