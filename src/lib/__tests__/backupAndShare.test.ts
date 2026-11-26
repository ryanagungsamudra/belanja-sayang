import { describe, expect, it } from 'vitest'
import { buildBackupSnapshot, parseBackupSnapshot } from '../backup'
import { formatIdrInput, parseIdrInput } from '../format'
import { formatCartShareText, formatMonthlyShareText } from '../share'
import { DEFAULT_CATEGORIES, DEFAULT_STORES } from '../stores'
import type {
  MarketItem,
  MonthlyPurchaseEntry,
  ProductReference,
} from '../../types/market'

describe('JSON Backup & Restore', () => {
  it('exports and validates a complete snapshot round-trip including monthlyBudget', () => {
    const snap = buildBackupSnapshot({
      stores: DEFAULT_STORES,
      categories: DEFAULT_CATEGORIES,
      productRefs: [],
      monthlyPurchases: [],
      items: [],
      templates: [],
      frequentItems: [],
      monthlyBudget: 1500000,
    })

    const { snapshot, error } = parseBackupSnapshot(JSON.stringify(snap))
    expect(error).toBeNull()
    expect(snapshot).not.toBeNull()
    expect(snapshot?.app).toBe('BelanjaSayang')
    expect(snapshot?.version).toBe(1)
    expect(snapshot?.monthlyBudget).toBe(1500000)
    expect(snapshot?.stores.length).toBe(DEFAULT_STORES.length)
  })

  it('rejects malformed JSON and invalid backup payloads safely', () => {
    expect(parseBackupSnapshot('{broken').error).toBeTruthy()
    expect(parseBackupSnapshot('{"app":"Other","version":1}').error).toBeTruthy()
    expect(
      parseBackupSnapshot(
        JSON.stringify({
          app: 'BelanjaSayang',
          version: 1,
          stores: [],
          categories: DEFAULT_CATEGORIES,
          productRefs: [],
          monthlyPurchases: [],
          items: [],
          templates: [],
        }),
      ).error,
    ).toBeTruthy()
  })
})

describe('WhatsApp Share Formatters & IDR Currency', () => {
  it('groups active cart items by store and includes unassigned + total', () => {
    const items: MarketItem[] = [
      {
        id: '1',
        name: 'Minyak 2L',
        quantity: '2 liter',
        category: 'Sembako',
        estimatedPrice: 41000,
        store: 'hypermart',
        isBought: false,
        createdAt: 1,
      },
      {
        id: '2',
        name: 'Ayam',
        quantity: '1',
        category: 'Daging & Ikan',
        estimatedPrice: 35000,
        store: null,
        isBought: false,
        createdAt: 2,
      },
    ]

    const text = formatCartShareText(items, DEFAULT_STORES)
    expect(text).toContain('*Hypermart (1)*')
    expect(text).toContain('• Minyak 2L (2 liter) — Rp 41.000')
    expect(text).toContain('*Belum Pilih Toko (1)*')
    expect(text).toContain('• Ayam — Rp 35.000')
    expect(text).toContain('Estimasi Total: *Rp 76.000*')
  })

  it('formats monthly recap with per-store totals and shorthand lines', () => {
    const refs: ProductReference[] = [
      {
        id: 'ref-1',
        name: 'Telur',
        normalizedName: 'telur',
        defaultQuantity: '1',
        category: 'Sembako',
        preferredStore: 'hypermart',
        prices: { hypermart: { price: 21000, updatedAt: 1 } },
        updatedAt: 1,
      },
    ]
    const entries: MonthlyPurchaseEntry[] = [
      {
        id: 'e-1',
        monthKey: '2026-11',
        productRefId: 'ref-1',
        productName: 'Telur',
        store: 'hypermart',
        price: 21000,
        purchasedAt: 1,
      },
    ]

    const text = formatMonthlyShareText(
      '2026-11',
      refs,
      entries,
      DEFAULT_STORES,
      21000,
      { hypermart: 21000 },
    )
    expect(text).toContain('Total: *Rp 21.000* (1 pembelian)')
    expect(text).toContain('• Hypermart: Rp 21.000')
    expect(text).toContain('telur H21/')
  })

  it('formats and parses IDR currency inputs accurately', () => {
    expect(formatIdrInput('1500000')).toBe('1.500.000')
    expect(formatIdrInput(41500)).toBe('41.500')
    expect(formatIdrInput(0)).toBe('')
    expect(parseIdrInput('Rp 1.500.000')).toBe(1500000)
    expect(parseIdrInput('')).toBe(0)
  })
})
