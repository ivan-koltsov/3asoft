/** @type {import('jest').Config} */
module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: 'src',
  testRegex: '(\\.(spec|integration))\\.ts$',
  transform: {
    '^.+\\.ts$': 'ts-jest',
  },
  collectCoverageFrom: ['**/*.ts', '!**/*.spec.ts', '!**/*.integration.ts', '!**/index.ts'],
  coverageDirectory: '../coverage',
  testEnvironment: 'node',
  moduleNameMapper: {
    '^@hatch/contracts$': '<rootDir>/../../../packages/contracts/src',
    '^@hatch/contracts/(.*)$': '<rootDir>/../../../packages/contracts/src/$1',
  },
};
