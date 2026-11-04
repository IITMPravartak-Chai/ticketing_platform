// Catches missing imports and leftover ones: npm run lint
import js from '@eslint/js';
import react from 'eslint-plugin-react';
import globals from 'globals';

export default [
  {ignores: ['dist/**']},
  {
    files: ['**/*.{js,jsx}'],
    plugins: {react},
    languageOptions: {ecmaVersion: 'latest', sourceType: 'module', globals: globals.browser, parserOptions: {ecmaFeatures: {jsx: true}}},
    settings: {react: {version: 'detect'}},
    rules: {
      ...js.configs.recommended.rules,
      'react/jsx-no-undef': 'error',
      'react/jsx-uses-vars': 'error',
      'no-unused-vars': ['error', {vars: 'all', args: 'none', caughtErrors: 'none'}],
      'no-empty': 'off',
    },
  },
  {files: ['vite.config.js', 'eslint.config.js'], languageOptions: {globals: globals.node}},
];
