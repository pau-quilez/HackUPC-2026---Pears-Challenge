/**
 * Pear on Windows misparses the usual pear-electron "pre" entry (pear-electron/pre)
 * and the bare runtime cannot resolve the pre’s dependencies if the desktop app
 * has no local node_modules tree. We link apps/desktop/node_modules to the
 * monorepo root node_modules (junction on Windows, symlink on Unix) so
 * "pre": "./node_modules/pear-electron/pre.js" matches the same layout as a flat install.
 */
const fs = require('fs')
const path = require('path')

const root = path.join(__dirname, '..')
const target = path.join(root, 'node_modules')
const link = path.join(root, 'apps', 'desktop', 'node_modules')

function isOurLink (current) {
  try {
    return fs.realpathSync(current) === fs.realpathSync(target)
  } catch {
    return false
  }
}

function main () {
  if (!fs.existsSync(target)) {
    return
  }

  if (!fs.existsSync(path.join(target, 'pear-electron', 'pre.js'))) {
    console.warn(
      '[postinstall] Root node_modules is incomplete (e.g. missing pear-electron). ' +
        'Run npm install from the monorepo root, not only from apps/desktop.'
    )
    return
  }

  if (fs.existsSync(link)) {
    if (isOurLink(link)) {
      return
    }
    fs.rmSync(link, { recursive: true, force: true })
  } else {
    fs.mkdirSync(path.dirname(link), { recursive: true })
  }

  if (process.platform === 'win32') {
    fs.symlinkSync(target, link, 'junction')
  } else {
    const rel = path.relative(path.dirname(link), target)
    fs.symlinkSync(rel, link, 'dir')
  }
}

main()
