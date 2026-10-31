// Starts the real binary for the end-to-end tests: node e2e/server.mjs
//
// It builds the frontend and the binaries into backend/.e2e (skipped with E2E_SKIP_BUILD=1), seeds a
// temporary data dir, creates a superuser and VAPID keys, and serves on 127.0.0.1:8099 until it gets
// SIGINT or SIGTERM. The data dir is removed when the server exits.
//
// Environment:
//   E2E_SUPERUSER_EMAIL, E2E_SUPERUSER_PASSWORD  superuser to create (required; playwright.config.ts
//                                                sets them and global-setup.ts logs in with them)
//   E2E_SKIP_BUILD=1                             use the binaries and frontend already built
import { execFileSync, spawn } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const webDir = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const backendDir = resolve(webDir, '../backend')
const binDir = join(backendDir, '.e2e')
const intern = join(binDir, 'intern')
const seed = join(binDir, 'seed')
const listen = '127.0.0.1:8099'
// PocketBase takes a binary under the temp dir for `go run` and turns on dev mode, which prints SQL
// to stdout (and would break parsing the output of intern vapid).
const noDev = '--dev=false'

const superuserEmail = process.env.E2E_SUPERUSER_EMAIL
const superuserPassword = process.env.E2E_SUPERUSER_PASSWORD
if (!superuserEmail || !superuserPassword) {
  console.error('e2e server: E2E_SUPERUSER_EMAIL and E2E_SUPERUSER_PASSWORD must be set')
  process.exit(1)
}

// Runs a setup command and returns its stdout; stderr is shown. A failure names the command but not
// its arguments, which can hold the superuser password.
/** @type {(cmd: string, args: string[], options?: import('node:child_process').ExecFileSyncOptions) => string} */
const run = (cmd, args, options = {}) => {
  try {
    return execFileSync(cmd, args, { stdio: ['ignore', 'pipe', 'inherit'], ...options }).toString()
  } catch (err) {
    const status = /** @type {{ status?: number }} */ (err).status
    throw new Error(`${basename(cmd)} ${args[0]} failed with exit code ${status ?? 'unknown'}`)
  }
}

if (process.env.E2E_SKIP_BUILD !== '1') {
  console.log('e2e server: building frontend and binaries')
  execFileSync('npm', ['run', 'build'], { cwd: webDir, stdio: ['ignore', 'ignore', 'inherit'] })
  const goEnv = { ...process.env, CGO_ENABLED: '0' }
  run('go', ['build', '-o', intern, './cmd/intern'], { cwd: backendDir, env: goEnv })
  run('go', ['build', '-o', seed, './cmd/seed'], { cwd: backendDir, env: goEnv })
}

const dataDir = mkdtempSync(join(tmpdir(), 'intern-e2e-'))
const cleanup = () => rmSync(dataDir, { recursive: true, force: true })

let vapid
try {
  run(seed, [dataDir], { env: { ...process.env, LOG_LEVEL: 'warn' } })
  run(intern, ['superuser', 'upsert', superuserEmail, superuserPassword, '--dir', dataDir, noDev])
  vapid = parseVapid(run(intern, ['vapid', '--dir', dataDir, noDev]))
} catch (err) {
  cleanup()
  console.error('e2e server: setup failed:', err instanceof Error ? err.message : err)
  process.exit(1)
}

// intern vapid prints exactly two KEY=value lines; anything else means the command changed.
/** @param {string} output */
function parseVapid(output) {
  const lines = output.trim().split('\n')
  const keys = Object.fromEntries(lines.map((/** @type {string} */ line) => line.split(/=(.*)/s, 2)))
  if (lines.length !== 2 || !keys.VAPID_PUBLIC_KEY || !keys.VAPID_PRIVATE_KEY) {
    throw new Error(`unexpected output of intern vapid (${lines.length} lines)`)
  }
  return keys
}

const child = spawn(intern, ['serve', '--dir', dataDir, '--http', listen, noDev], {
  stdio: 'inherit',
  env: {
    ...process.env,
    PASSKEY_RP_ID: 'localhost',
    PASSKEY_ORIGIN: 'http://localhost:8099',
    VAPID_PUBLIC_KEY: vapid.VAPID_PUBLIC_KEY,
    VAPID_PRIVATE_KEY: vapid.VAPID_PRIVATE_KEY,
    VAPID_SUBJECT: 'mailto:e2e@example.com',
    LOG_LEVEL: 'warn',
  },
})

for (const signal of /** @type {const} */ (['SIGINT', 'SIGTERM'])) {
  process.on(signal, () => child.kill(signal))
}

child.on('exit', (code, signal) => {
  cleanup()
  process.exit(code ?? (signal ? 0 : 1))
})
