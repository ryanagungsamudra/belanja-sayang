import { describe, expect, it } from 'vitest'
import { formatIdrInput, hashPin, parseIdrInput } from '../format'
import {
  DEFAULT_STORES,
  getCheapestStore,
  getReferencePriceForStore,
  sortByNameAZ,
} from '../stores'
import type { ProductReference } from '../../types/market'

describe('stores & format utilities', () => {
  const sampleRef: ProductReference = {
    id: 'ref-1',
    name: 'Kentang',
    normalizedName: 'kentang',
    defaultQuantity: '1 kg',
    category: 'Sayur & Buah',
    preferredStore: 'hypermart',
    prices: {
      hypermart: { price: 15000, updatedAt: 100 },
      pasar: { price: 8000, updatedAt: 100 },
    },
    updatedAt: 100,
  }

  it('finds the cheapest store accurately across multiple saved prices', () => {
    expect(getCheapestStore(sampleRef, DEFAULT_STORES)).toEqual({
      store: 'pasar',
      price: 8000,
    })
  })

  it('resolves store-specific reference price with fallback to preferred/cheapest', () => {
    expect(
      getReferencePriceForStore(sampleRef, 'pasar', DEFAULT_STORES),
    ).toEqual({ store: 'pasar', price: 8000 })
    expect(
      getReferencePriceForStore(sampleRef, null, DEFAULT_STORES),
    ).toEqual({ store: 'hypermart', price: 15000 })
  })

  it('sorts names A-Z case-insensitively with Indonesian collator', () => {
    const sorted = sortByNameAZ([
      { name: 'tomat' },
      { name: 'Ayam' },
      { name: 'bawang merah' },
    ])
    expect(sorted.map((s) => s.name)).toEqual(['Ayam', 'bawang merah', 'tomat'])
  })

  it('produces deterministic, non-plaintext PIN hashes', () => {
    const h1 = hashPin('1234')
    const h2 = hashPin('1234')
    const h3 = hashPin('5678')
    expect(h1).toBe(h2)
    expect(h1).not.toBe(h3)
    expect(h1).not.toContain('1234')
  })

  it('formats and parses IDR currency inputs with Indonesian thousand dots', () => {
    expect(formatIdrInput(0)).toBe('')
    expect(formatIdrInput('')).toBe('')
    expect(formatIdrInput(500)).toBe('500')
    expect(formatIdrInput(15000)).toBe('15.000')
    expect(formatIdrInput('125000')).toBe('125.000')
    expect(formatIdrInput('Rp 1.026.000')).toBe('1.026.000')
    expect(parseIdrInput('15.000')).toBe(15000)
    expect(parseIdrInput('Rp 1.026.000')).toBe(1026000)
    expect(parseIdrInput('')).toBe(0)
  })
})
