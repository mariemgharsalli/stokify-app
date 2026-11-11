/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: "node",
  testMatch: ["**/*.test.js"],
  roots: ["<rootDir>/src"],
  setupFiles: ["<rootDir>/src/__tests__/helpers/jest.setup.js"],
  coveragePathIgnorePatterns: ["/node_modules/", "/__tests__/"],
  coverageReporters: ["text", "text-summary"],
};
