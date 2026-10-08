import js from '@eslint/js'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  { ignores: ['dist'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      // Nest внедряет зависимости по метаданным типов — такие импорты не должны становиться type-only
      '@typescript-eslint/consistent-type-imports': 'off',
    },
  },
)
