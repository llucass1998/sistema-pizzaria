import globals from 'globals';
import pluginJs from '@eslint/js';
import pluginReact from 'eslint-plugin-react';

export default [
  {
    ignores: [
      '.chrome-test/**',
      '.claude/**',
      'coverage/**',
      'dist/**',
      'generated/**',
      'node_modules/**',
      'playwright-report/**',
      'scratch/**',
      'backend-src/check.js',
      'fix-theme.cjs',
      'out.js',
      'temp.js',
      'test_*.js',
      'tmp-*.js',
    ],
  },
  pluginJs.configs.recommended,
  pluginReact.configs.flat.recommended,
  {
    files: ['**/*.{js,mjs,cjs,jsx}'],
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    settings: {
      react: {
        version: 'detect',
      },
    },
    rules: {
      'no-undef': 'error',
      'react/prop-types': 'off',
      'react/react-in-jsx-scope': 'off',
      'no-unused-vars': 'warn',
    },
  },
];
