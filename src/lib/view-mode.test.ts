import { describe, expect, it } from 'vitest'

import { isViewMode, parseViewCookie, VIEW_COOKIE } from '#/lib/view-mode'

describe('isViewMode', () => {
  it('accepts the three known views and nothing else', () => {
    expect(isViewMode('table')).toBe(true)
    expect(isViewMode('grouped')).toBe(true)
    expect(isViewMode('cards')).toBe(true)
    expect(isViewMode('list')).toBe(false)
    expect(isViewMode(undefined)).toBe(false)
    expect(isViewMode(null)).toBe(false)
  })
})

describe('parseViewCookie', () => {
  it('finds the view among other cookies', () => {
    expect(parseViewCookie(`a=1; ${VIEW_COOKIE}=grouped; b=2`)).toBe('grouped')
  })

  it('tolerates the absence of surrounding whitespace', () => {
    expect(parseViewCookie(`${VIEW_COOKIE}=cards`)).toBe('cards')
  })

  it('falls back to the table view when unset', () => {
    expect(parseViewCookie(null)).toBe('table')
    expect(parseViewCookie(undefined)).toBe('table')
    expect(parseViewCookie('')).toBe('table')
    expect(parseViewCookie('other=grouped')).toBe('table')
  })

  it('ignores a value that is not a view', () => {
    expect(parseViewCookie(`${VIEW_COOKIE}=../../etc/passwd`)).toBe('table')
    expect(parseViewCookie(`${VIEW_COOKIE}=`)).toBe('table')
  })

  it('does not match a cookie whose name merely ends with the key', () => {
    expect(parseViewCookie(`not-${VIEW_COOKIE}=grouped`)).toBe('table')
  })
})
