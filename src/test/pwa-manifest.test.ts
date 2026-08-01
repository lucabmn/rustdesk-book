import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import {
  APP_ICONS,
  PWA_BACKGROUND_COLOR,
  PWA_HEAD_LINKS,
  PWA_HEAD_META,
} from '#/lib/pwa'

/**
 * The manifest and its icons are shipped as static files, so nothing at build
 * time can catch a typo'd path or a `sizes` that disagrees with the actual
 * pixels — a browser just silently drops the icon. These tests read the files
 * that are really served and compare them against `src/lib/pwa.ts`, which is
 * what the document head is built from.
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

const manifest = JSON.parse(
  readFileSync(new URL('manifest.webmanifest', publicDir), 'utf8'),
)

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
    expect(manifest.theme_color).toBe(PWA_BACKGROUND_COLOR)
    expect(manifest.background_color).toBe(PWA_BACKGROUND_COLOR)
  })

  it('serves the same icon set the document head is built from', () => {
    expect(manifest.icons).toEqual(APP_ICONS)
  })

  it('covers the sizes an install prompt requires, maskable included', () => {
    const any = APP_ICONS.filter((icon) => icon.purpose === 'any')
    expect(any.some((icon) => icon.sizes === '192x192')).toBe(true)
    expect(any.some((icon) => icon.sizes === '512x512')).toBe(true)
    expect(APP_ICONS.some((icon) => icon.purpose === 'maskable')).toBe(true)
  })

  it('ships every declared icon at the size it claims', () => {
    for (const icon of APP_ICONS) {
      expect(pngSize(readPublic(icon.src)), icon.src).toBe(icon.sizes)
      expect(icon.type).toBe('image/png')
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
})
