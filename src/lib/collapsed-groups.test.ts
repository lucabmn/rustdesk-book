import { describe, expect, it } from 'vitest'

import {
  parseCollapsedGroups,
  serializeCollapsedGroups,
  toggleCollapsed,
} from '#/lib/collapsed-groups'

describe('parseCollapsedGroups', () => {
  it('reads a stored list of group keys', () => {
    expect(parseCollapsedGroups('["Acme","Globex"]')).toEqual(
      new Set(['Acme', 'Globex']),
    )
  })

  it('keeps the empty key, which identifies the unassigned bucket', () => {
    expect(parseCollapsedGroups('[""]')).toEqual(new Set(['']))
  })

  it('treats missing storage as nothing collapsed', () => {
    expect(parseCollapsedGroups(null)).toEqual(new Set())
    expect(parseCollapsedGroups('')).toEqual(new Set())
  })

  it('survives anything a user could have put in localStorage', () => {
    expect(parseCollapsedGroups('not json')).toEqual(new Set())
    expect(parseCollapsedGroups('{"a":1}')).toEqual(new Set())
    expect(parseCollapsedGroups('"Acme"')).toEqual(new Set())
    expect(parseCollapsedGroups('null')).toEqual(new Set())
  })

  it('drops non-string members instead of the whole list', () => {
    expect(parseCollapsedGroups('["Acme",1,null,{},"Globex"]')).toEqual(
      new Set(['Acme', 'Globex']),
    )
  })
})

describe('serializeCollapsedGroups', () => {
  it('round-trips through parse', () => {
    const keys = new Set(['Globex', 'Acme', ''])
    expect(parseCollapsedGroups(serializeCollapsedGroups(keys))).toEqual(keys)
  })

  it('sorts, so the stored value does not churn on reordering', () => {
    expect(serializeCollapsedGroups(new Set(['b', 'a']))).toBe(
      serializeCollapsedGroups(new Set(['a', 'b'])),
    )
  })
})

describe('toggleCollapsed', () => {
  it('collapses a group that was open', () => {
    expect(toggleCollapsed(new Set(), 'Acme')).toEqual(new Set(['Acme']))
  })

  it('expands a group that was collapsed', () => {
    expect(toggleCollapsed(new Set(['Acme', 'Globex']), 'Acme')).toEqual(
      new Set(['Globex']),
    )
  })

  it('does not mutate the set it was given', () => {
    const current = new Set(['Acme'])
    toggleCollapsed(current, 'Globex')
    expect(current).toEqual(new Set(['Acme']))
  })
})
