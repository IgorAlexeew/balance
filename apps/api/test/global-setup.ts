import { execSync } from 'node:child_process'
import { rmSync } from 'node:fs'
import path from 'node:path'

/** Свежая тестовая БД по текущей схеме перед прогоном */
export default function setup() {
  const cwd = path.resolve(import.meta.dirname, '..')
  rmSync(path.join(cwd, 'prisma/test.db'), { force: true })
  execSync('pnpm exec prisma db push --skip-generate', {
    cwd,
    env: { ...process.env, DATABASE_URL: 'file:./test.db' },
    stdio: 'pipe',
  })
}
