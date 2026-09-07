// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*', '.expo/*'],
  },
  {
    // Jest manual mocks run only in the jest environment.
    files: ['**/__mocks__/**'],
    languageOptions: { globals: { jest: 'readonly', module: 'writable', require: 'readonly' } },
  },
]);
