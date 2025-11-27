import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    rules: {
      // Allow Math.random in useMemo/component initialization (stable values)
      'react-hooks/purity': 'off',
      // Allow refs access for previous value patterns
      'react-hooks/refs': 'off',
      // Allow setState in effects for derived state patterns
      'react-hooks/set-state-in-effect': 'off',
    },
  },
  // Relaxed rules for admin panel (internal tool)
  {
    files: ['**/admin/**/*.{ts,tsx}', '**/utils/ai.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      'react-hooks/exhaustive-deps': 'warn',
    },
  },
])
