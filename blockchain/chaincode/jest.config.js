/** WP-21: Jest — mismo framework que el backend (docs/WP-21-plan-chaincode.md §2.1). */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/test'],
  testMatch: ['**/*.spec.ts'],
}
