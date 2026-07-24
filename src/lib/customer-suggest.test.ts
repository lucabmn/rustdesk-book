import { describe, expect, it } from 'vitest'

import { filterCustomers, shouldOfferCreate } from './customer-suggest'

describe('filterCustomers', () => {
  const all = [
    'Bäckerei Krause GmbH',
    'Sanitätshaus Baumann',
    'Acme Bakery Ltd.',
  ]

  it('returns every option for an empty query', () => {
    expect(filterCustomers(all, '')).toEqual(all)
    expect(filterCustomers(all, '   ')).toEqual(all)
  })

  it('matches case-insensitively on a substring', () => {
    expect(filterCustomers(all, 'baum')).toEqual(['Sanitätshaus Baumann'])
    expect(filterCustomers(all, 'BAKERY')).toEqual(['Acme Bakery Ltd.'])
  })

  it('trims surrounding whitespace before matching', () => {
    expect(filterCustomers(all, '  acme  ')).toEqual(['Acme Bakery Ltd.'])
  })

  it('returns an empty list when nothing matches', () => {
    expect(filterCustomers(all, 'zzz')).toEqual([])
  })
})

describe('shouldOfferCreate', () => {
  const all = ['Sanitätshaus Baumann', 'Acme Bakery Ltd.']

  it('offers create for a non-empty query with no exact match', () => {
    expect(shouldOfferCreate(all, 'Sanitätshaus Bauman')).toBe(true)
  })

  it('does not offer create when the query exactly matches an option', () => {
    expect(shouldOfferCreate(all, 'Acme Bakery Ltd.')).toBe(false)
  })

  it('treats an exact match case-insensitively and ignoring surrounding space', () => {
    expect(shouldOfferCreate(all, '  acme bakery ltd.  ')).toBe(false)
  })

  it('does not offer create for an empty query', () => {
    expect(shouldOfferCreate(all, '')).toBe(false)
    expect(shouldOfferCreate(all, '   ')).toBe(false)
  })
})
