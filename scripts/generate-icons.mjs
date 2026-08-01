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
 * `opaque: false` keeps the mark's own rounded tile on a transparent field.
 * `true` extends the tile's colour edge to edge behind it, which is what a
 * maskable icon and an iOS home screen both need: the mask and iOS's own
 * black matte would otherwise eat the rounded corners.
 */
const TARGETS = [
  { file: 'icon-192.png', size: 192, opaque: false },
  { file: 'icon-512.png', size: 512, opaque: false },
  { file: 'icon-maskable-512.png', size: 512, opaque: true },
  { file: 'apple-touch-icon.png', size: 180, opaque: true },
]

/** The tile colour, read off the mark's own backdrop so it cannot drift. */
function tileColour(svg) {
  const fill = svg.match(/<rect[^>]*\sfill="(#[0-9a-fA-F]{3,8})"/)?.[1]
  if (!fill) throw new Error('No tile <rect fill="#…"> found in icon.svg.')
  return fill
}

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
    html,body{margin:0;padding:0;background:${background}}
    svg{display:block}
  </style>${svgAtSize}`
}

const chrome = findChrome()
const svg = readFileSync(join(publicDir, 'icon.svg'), 'utf8')
const tile = tileColour(svg)
const work = mkdtempSync(join(tmpdir(), 'rdb-icons-'))

try {
  for (const { file, size, opaque } of TARGETS) {
    const html = join(work, `${file}.html`)
    writeFileSync(html, page(svg, size, opaque ? tile : 'transparent'))

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
