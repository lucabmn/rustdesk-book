import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import { PWA_HEAD_LINKS, PWA_HEAD_META } from '#/lib/pwa'
import { THEME_COLOR } from '#/lib/theme'

/**
 * The manifest and its icons are shipped as static files, so nothing at build
 * time can catch a typo'd path or a `sizes` that disagrees with the actual
 * pixels — a browser just drops the icon without a word. These tests read the
 * files that are really served and check them against each other and against
 * the head tags in `src/lib/pwa.ts`.
 */

const publicDir = new URL('../../public/', import.meta.url)

/** Width and height of a PNG, from the IHDR chunk (big-endian at 16 and 20). */
function pngSize(bytes: Buffer): string {
  expect(bytes.subarray(1, 4).toString('ascii')).toBe('PNG')
  return `${bytes.readUInt32BE(16)}x${bytes.readUInt32BE(20)}`
}

function readPublic(href: string): Buffer {
  return readFileSync(new URL(href.replace(/^\//, ''), publicDir))
}

interface ManifestIcon {
  src: string
  sizes: string
  type: string
  purpose: string
}

const manifest: {
  short_name: string
  theme_color: string
  background_color: string
  icons: ManifestIcon[]
} = JSON.parse(readPublic('manifest.webmanifest').toString('utf8'))

describe('web app manifest', () => {
  it('declares what an installable app needs', () => {
    expect(manifest).toMatchObject({
      id: '/',
      start_url: '/',
      scope: '/',
      display: 'standalone',
      name: expect.any(String),
      short_name: expect.any(String),
      description: expect.any(String),
      lang: 'de',
    })
  })

  it('keeps short_name inside the 12 characters a launcher shows', () => {
    expect(manifest.short_name.length).toBeLessThanOrEqual(12)
  })

  it('paints its splash in the colour the app itself opens with', () => {
    // A manifest holds one colour, so it is the default theme's — the live
    // `theme-color` meta in src/lib/theme.ts is what follows a user's choice.
    expect(manifest.theme_color).toBe(THEME_COLOR.dark)
    expect(manifest.background_color).toBe(THEME_COLOR.dark)
  })

  it('covers the sizes an install prompt requires, maskable included', () => {
    const any = manifest.icons.filter((icon) => icon.purpose === 'any')
    expect(any.some((icon) => icon.sizes === '192x192')).toBe(true)
    expect(any.some((icon) => icon.sizes === '512x512')).toBe(true)
    expect(manifest.icons.some((icon) => icon.purpose === 'maskable')).toBe(
      true,
    )
  })

  it('ships every declared icon at the size and type it claims', () => {
    for (const icon of manifest.icons) {
      expect(pngSize(readPublic(icon.src)), icon.src).toBe(icon.sizes)
      expect(icon.type, icon.src).toBe('image/png')
    }
  })
})

describe('document head', () => {
  it('links the manifest that is actually served', () => {
    const link = PWA_HEAD_LINKS.find((entry) => entry.rel === 'manifest')
    expect(link).toBeDefined()
    expect(() => readPublic(link?.href ?? '')).not.toThrow()
  })

  it('gives iOS a 180px PNG, which is the only thing it renders', () => {
    const link = PWA_HEAD_LINKS.find(
      (entry) => entry.rel === 'apple-touch-icon',
    )
    expect(link).toBeDefined()
    expect(link?.href).toMatch(/\.png$/)
    expect(pngSize(readPublic(link?.href ?? ''))).toBe('180x180')
  })

  it('asks both engines for a standalone window', () => {
    const byName = new Map(
      PWA_HEAD_META.map((meta) => [meta.name, meta.content]),
    )
    expect(byName.get('mobile-web-app-capable')).toBe('yes')
    expect(byName.get('apple-mobile-web-app-capable')).toBe('yes')
    expect(byName.get('apple-mobile-web-app-status-bar-style')).toBe('default')
  })

  it('labels the iOS home screen with the launcher name, not the title', () => {
    const title = PWA_HEAD_META.find(
      (meta) => meta.name === 'apple-mobile-web-app-title',
    )
    expect(title?.content).toBe(manifest.short_name)
  })
})
