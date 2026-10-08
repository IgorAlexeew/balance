import fsd from '@feature-sliced/steiger-plugin'
import { defineConfig } from 'steiger'

export default defineConfig([
  ...fsd.configs.recommended,
  {
    rules: {
      // Слайсы, используемые одной страницей, — осознанное разбиение по смыслу
      'fsd/insignificant-slice': 'off',
    },
  },
])
