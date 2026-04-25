/**
 * Flujo recomendado en Windows (monorepo + Pear desktop):
 * 1) npm install en la raíz (no solo en apps/desktop)
 * 2) enlace apps/desktop/node_modules -> raíz node_modules
 * 3) pear run --dev apps/desktop desde la raíz
 *
 * Desactiva el paso 1: set SKIP_NPM_INSTALL=1 (o true) al invocar.
 */
const { spawnSync } = require('child_process')
const fs = require('fs')
const path = require('path')

const root = path.join(__dirname, '..')
const skipInstall =
  process.env.SKIP_NPM_INSTALL === '1' || process.env.SKIP_NPM_INSTALL === 'true'

function run (cmd, args) {
  const r = spawnSync(cmd, args, { cwd: root, stdio: 'inherit', shell: true })
  if (r.status !== 0 && r.status != null) {
    process.exit(r.status)
  }
  if (r.error) {
    console.error(r.error)
    process.exit(1)
  }
}

process.chdir(root)

if (!skipInstall) {
  run('npm', ['install'])
} else {
  console.log('[dev-pear-desktop] Omitiendo npm install (SKIP_NPM_INSTALL=1).')
}

run('node', [path.join('scripts', 'ensure-desktop-node-modules.cjs')])

const pre = path.join(root, 'node_modules', 'pear-electron', 'pre.js')
if (!fs.existsSync(pre)) {
  console.error(
    '[dev-pear-desktop] Falta pear-electron. Ejecuta "npm install" en la raíz del monorepo (no en apps/desktop).'
  )
  process.exit(1)
}

const pear = spawnSync('pear', ['run', '--dev', 'apps/desktop'], {
  cwd: root,
  stdio: 'inherit',
  shell: true
})
if (pear.error) {
  console.error('[dev-pear-desktop] No se encontró "pear" en el PATH. Instala: https://docs.pears.com')
  console.error(pear.error)
  process.exit(1)
}
process.exit(pear.status ?? 0)
