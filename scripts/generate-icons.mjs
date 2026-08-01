#!/usr/bin/env node
/**
 * Renders the PWA icon set in `public/` from the single source of truth,
 * `public/icon.svg`.
 *
 * The results are committed, and CI never runs this — it needs a browser to
 * rasterise, which the build image has no reason to carry. Run it by hand when
 * the mark changes:
 *
 *   node scripts/generate-icons.mjs
 *
 * It shells out to a headless Chrome. Point `CHROME_PATH` at one if the
 * lookup below misses; any recent Chrome or Chromium will do.
 */

import { execFileSync } from 'node:child_process'
import {
  existsSync,
  globSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const publicDir = fileURLToPath(new URL('../public/', import.meta.url))

/**
 * `null` keeps the mark's own rounded tile on a transparent field. A colour
 * fills the frame edge to edge, which is what a maskable icon and an iOS home
 * screen both need — see the note on `AppIcon` in src/lib/pwa.ts.
 */
const TILE = '#1b1e27'

const TARGETS = [
  { file: 'icon-192.png', size: 192, background: null },
  { file: 'icon-512.png', size: 512, background: null },
  { file: 'icon-maskable-512.png', size: 512, background: TILE },
  { file: 'apple-touch-icon.png', size: 180, background: TILE },
]

function findChrome() {
  if (process.env.CHROME_PATH) return process.env.CHROME_PATH
  const candidates = [
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
    ...globSync(
      join(
        process.env.HOME ?? '',
        'Library/Caches/ms-playwright/chromium*/chrome-*/**/{Chromium,chrome,chrome-headless-shell}',
      ),
    ),
  ]
  const found = candidates.find((path) => existsSync(path))
  if (!found) {
    throw new Error('No Chrome found — set CHROME_PATH to one.')
  }
  return found
}

/**
 * The SVG goes into the page inline rather than as an `<img src>`: a headless
 * screenshot of a remote-ish resource races the capture, an inline element is
 * laid out before first paint.
 */
function page(svg, size, background) {
  const svgAtSize = svg
    .replace(/\swidth="\d+"/, ` width="${size}"`)
    .replace(/\sheight="\d+"/, ` height="${size}"`)
  return `<!doctype html><meta charset="utf-8"><style>
    html,body{margin:0;padding:0;background:${background ?? 'transparent'}}
    svg{display:block}
  </style>${svgAtSize}`
}

const chrome = findChrome()
const svg = readFileSync(join(publicDir, 'icon.svg'), 'utf8')
const work = mkdtempSync(join(tmpdir(), 'rdb-icons-'))

try {
  for (const { file, size, background } of TARGETS) {
    const html = join(work, `${file}.html`)
    writeFileSync(html, page(svg, size, background))

    execFileSync(
      chrome,
      [
        '--headless',
        '--disable-gpu',
        '--hide-scrollbars',
        // Without this the page is composited onto opaque white and the
        // rounded tile's corners come out white instead of clear.
        '--default-background-color=00000000',
        `--window-size=${size},${size}`,
        `--screenshot=${join(publicDir, file)}`,
        `file://${html}`,
      ],
      { stdio: 'ignore' },
    )
    console.log(`public/${file}  ${size}x${size}`)
  }
} finally {
  rmSync(work, { recursive: true, force: true })
}
