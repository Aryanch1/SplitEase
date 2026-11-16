const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  ...expoConfig,
  {
    ignores: ['dist/*', 'node_modules/*'],
  },
  {
    // Reanimated's API is built on assigning to SharedValue `.value`
    // inside event handlers, effects and worklets. The React hooks
    // immutability rule flags every one of those assignments, so it is
    // off here; no render-phase mutation is used anywhere in the app.
    rules: {
      'react-hooks/immutability': 'off',
    },
  },
]);
