import { describe, expect, it } from 'vitest'

import {
  buildListInput,
  EMPTY_FILTERS,
  groupByCustomer,
  hasActiveFilters,
  initialsOf,
  mergeOsOptions,
  toggleTag,
} from '#/lib/address-book-filters'
import type { Device } from '#/orpc/schema'

const device = (overrides: Partial<Device>): Device =>
  ({
    id: 'id',
    rustdeskId: '123456789',
    alias: 'PC',
    customer: null,
    customerId: null,
    osKey: null,
    tags: [],
    status: 'offline',
    lastSeen: null,
    hasPassword: false,
    isFavorite: false,
    notes: null,
    createdAt: '',
    updatedAt: '',
    ...overrides,
  }) as Device

describe('buildListInput', () => {
  it('omits every inactive filter', () => {
    expect(buildListInput(EMPTY_FILTERS)).toEqual({
      search: undefined,
      status: undefined,
      osKey: undefined,
      customer: undefined,
      tags: undefined,
      favorite: undefined,
      groupId: undefined,
    })
  })

  it('trims the search term and passes the active filters through', () => {
    expect(
      buildListInput({
        search: '  reception  ',
        status: 'online',
        osKey: 'Windows 11',
        customer: 'Acme',
        favorite: true,
        groupId: 'group-1',
        tags: ['office'],
      }),
    ).toEqual({
      search: 'reception',
      status: 'online',
      osKey: 'Windows 11',
      customer: 'Acme',
      tags: ['office'],
      favorite: true,
      groupId: 'group-1',
    })
  })

  it('treats a whitespace-only search as no search', () => {
    expect(buildListInput({ ...EMPTY_FILTERS, search: '   ' }).search).toBeUndefined()
  })
})

describe('hasActiveFilters', () => {
  it('is false for the pristine state', () => {
    expect(hasActiveFilters(EMPTY_FILTERS)).toBe(false)
  })

  it('is true as soon as any single filter is set', () => {
    const variants = [
      { search: 'x' },
      { status: 'online' },
      { osKey: 'Windows 11' },
      { customer: 'Acme' },
      { favorite: true },
      { groupId: 'g' },
      { tags: ['office'] },
    ]
    for (const variant of variants) {
      expect(hasActiveFilters({ ...EMPTY_FILTERS, ...variant })).toBe(true)
    }
  })
})

describe('toggleTag', () => {
  it('adds, then removes, leaving the other tags in place', () => {
    expect(toggleTag(['a'], 'b')).toEqual(['a', 'b'])
    expect(toggleTag(['a', 'b'], 'a')).toEqual(['b'])
  })
})

describe('mergeOsOptions', () => {
  it('merges stored values with the presets, deduped and sorted', () => {
    const merged = mergeOsOptions(['Windows 11', 'AlmaLinux 9'])
    expect(merged).toContain('AlmaLinux 9')
    expect(merged.filter((o) => o === 'Windows 11')).toHaveLength(1)
    expect([...merged]).toEqual([...merged].sort((a, b) => a.localeCompare(b, 'de')))
  })

  it('falls back to the presets alone', () => {
    expect(mergeOsOptions()).toContain('Windows 11')
  })
})

describe('groupByCustomer', () => {
  it('buckets by customer and sorts the groups by name', () => {
    const groups = groupByCustomer(
      [
        device({ id: '1', customer: 'Globex' }),
        device({ id: '2', customer: null }),
        device({ id: '3', customer: 'Acme' }),
        device({ id: '4', customer: 'Acme' }),
      ],
      'Ohne Kunde',
    )
    expect(groups.map((g) => g.name)).toEqual(['Acme', 'Globex', 'Ohne Kunde'])
    expect(groups[0].items).toHaveLength(2)
  })

  it('returns nothing for an empty list', () => {
    expect(groupByCustomer([], 'Ohne Kunde')).toEqual([])
  })
})

describe('initialsOf', () => {
  it('takes the first two characters, upper-cased', () => {
    expect(initialsOf('luca')).toBe('LU')
    expect(initialsOf('A')).toBe('A')
  })
})
