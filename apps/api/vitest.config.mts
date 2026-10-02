import swc from 'unplugin-swc'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  // SWC вместо esbuild: Nest нужны метаданные декораторов (emitDecoratorMetadata)
  plugins: [swc.vite()],
  test: {
    globalSetup: ['./test/global-setup.ts'],
    setupFiles: ['./test/setup.ts'],
    // Тесты используют одну SQLite-базу — запускаем файлы последовательно
    fileParallelism: false,
    env: {
      NODE_ENV: 'test',
      DATABASE_URL: 'file:./test.db',
    },
  },
})
