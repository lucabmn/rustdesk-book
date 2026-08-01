import { createHash } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { build } from 'esbuild'

import { PWA_HEAD_LINKS } from '../src/lib/pwa'

import type { Plugin } from 'vite'

/**
 * Builds `src/sw/entry.ts` into the client output as `/sw.js`.
 *
 * It rides along with the client build rather than running after it because
 * Nitro bakes the list of public files into the server bundle at build time —
 * a file dropped into `.output/public` afterwards exists on disk and still
 * 404s. Emitting it here puts it in the client bundle, which Nitro then picks
 * up like any other asset.
 *
 * The worker is not a Vite entry of its own: it must sit unhashed at the root
 * of the origin (a worker only controls its own directory and below) and it
 * must not exist in dev at all, so it gets bundled separately by esbuild and
 * emitted under a fixed name.
 *
 * Two values are injected:
 *   - `__SW_PRECACHE__` — the built assets plus the static files that make up
 *     the installable app, taken from the bundle so a renamed chunk cannot go
 *     stale
 *   - `__SW_VERSION__` — a hash over the worker's own code and that list,
 *     which names the caches and is what makes a browser see a new worker
 *     (and the user an update prompt) after a deploy
 */

const root = new URL('../', import.meta.url)

/**
 * The unhashed files an installed app needs before it has been anywhere: the
 * manifest, the icons it and the document head point at. Read from those two
 * sources rather than listed again here, so adding an icon stays one edit.
 */
function staticShell(): string[] {
  const manifestPath = '/manifest.webmanifest'
  const manifest: { icons: { src: string }[] } = JSON.parse(
    readFileSync(new URL(`public${manifestPath}`, root), 'utf8'),
  )
  return [
    ...new Set([
      manifestPath,
      // The tab icon, which `src/routes/__root.tsx` links directly.
      '/favicon.svg',
      ...manifest.icons.map((icon) => icon.src),
      ...PWA_HEAD_LINKS.map((link) => link.href),
    ]),
  ]
}

export function serviceWorkerPlugin(): Plugin {
  return {
    name: 'rustdesk-book:service-worker',
    apply: 'build',
    applyToEnvironment: (environment) => environment.name === 'client',
    async generateBundle(_options, bundle) {
      const shell = staticShell()
      const publicDir = new URL('public/', root)
      const missing = shell.filter(
        (path) => !existsSync(new URL(path.slice(1), publicDir)),
      )
      if (missing.length > 0) {
        // A path that is not served is one the worker would fail to store on
        // every install; better to hear about it here than in a browser.
        this.error(
          `service worker: no such file in public/: ${missing.join(', ')}`,
        )
      }

      const assets = Object.keys(bundle)
        .filter((fileName) => !fileName.endsWith('.map'))
        .map((fileName) => `/${fileName}`)
        .sort()
      const precache = [...shell, ...assets]

      const bundled = await build({
        entryPoints: [fileURLToPath(new URL('src/sw/entry.ts', root))],
        bundle: true,
        format: 'iife',
        target: 'es2020',
        minify: true,
        write: false,
        legalComments: 'none',
        alias: { '#': fileURLToPath(new URL('src', root)) },
        define: {
          __SW_PRECACHE__: JSON.stringify(precache),
          // Replaced below, once there is a bundle to hash.
          __SW_VERSION__: JSON.stringify('__SW_VERSION__'),
        },
      })

      const source = bundled.outputFiles[0].text
      // Hashing the bundle and not just the file list means a change to the
      // worker's own rules also ships as a new version, cache names and all.
      const version = createHash('sha256')
        .update(source)
        .digest('hex')
        .slice(0, 12)

      this.emitFile({
        type: 'asset',
        fileName: 'sw.js',
        source: source.replaceAll('__SW_VERSION__', version),
      })
      this.info(`sw.js ${version}, ${precache.length} files precached`)
    },
  }
}
