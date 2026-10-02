import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  platform: 'node',
  target: 'node22',
  clean: true,
  sourcemap: true,
  // contracts — исходники TS из воркспейса, вшиваем их в бандл
  noExternal: ['@balance/contracts'],
})
