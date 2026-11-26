import { describe, expect, it } from 'vitest'
import {
  buildSeedFromWifeNote,
  exportMonthlyNoteText,
  formatPurchaseChip,
  parseMonthlyNoteText,
  parseShorthandToken,
  STARTER_WIFE_NOTE,
} from '../noteParser'
import { DEFAULT_STORES } from '../stores'

describe('noteParser', () => {
  it('parses standard, decimal, qty-prefixed, missing-price, and brand-annotated tokens', () => {
    expect(parseShorthandToken('H13', 'hypermart', DEFAULT_STORES)).toEqual({
      store: 'hypermart',
      price: 13000,
      qtyNote: undefined,
    })
    expect(parseShorthandToken('H9,5', 'hypermart', DEFAULT_STORES)).toEqual({
      store: 'hypermart',
      price: 9500,
      qtyNote: undefined,
    })
    expect(parseShorthandToken('In21', 'hypermart', DEFAULT_STORES)).toEqual({
      store: 'minimarket',
      price: 21000,
      qtyNote: undefined,
    })
    expect(parseShorthandToken('2H29', 'hypermart', DEFAULT_STORES)).toEqual({
      store: 'hypermart',
      price: 29000,
      qtyNote: '2',
    })
    expect(parseShorthandToken('H', 'hypermart', DEFAULT_STORES)).toEqual({
      store: 'hypermart',
      price: 0,
      qtyNote: undefined,
    })
    expect(
      parseShorthandToken('sania 2L H41', 'hypermart', DEFAULT_STORES),
    ).toEqual({
      store: 'hypermart',
      price: 41000,
      qtyNote: 'sania 2L',
    })
    expect(parseShorthandToken('21', 'hypermart', DEFAULT_STORES)).toEqual({
      store: 'hypermart',
      price: 21000,
    })
  })

  it('supports custom user-defined store codes', () => {
    const customStores = [
      ...DEFAULT_STORES,
      {
        id: 'superindo',
        name: 'Superindo',
        shortLabel: 'Superindo',
        code: 'S',
        color: '#0284C7',
      },
    ]
    expect(parseShorthandToken('S17,5', 'hypermart', customStores)).toEqual({
      store: 'superindo',
      price: 17500,
      qtyNote: undefined,
    })
  })

  it('parses the full 40-item household note accurately (Rp 904.000, 64 entries)', () => {
    const { refs, entries } = buildSeedFromWifeNote('2026-11')
    expect(refs).toHaveLength(40)
    expect(entries).toHaveLength(64)
    const total = entries.reduce((s, e) => s + e.price, 0)
    expect(total).toBe(904000)

    const tomatSaus = entries.find((e) => e.productName === 'Saus Delmonte Tomat')
    expect(tomatSaus?.price).toBe(0)
    expect(formatPurchaseChip(tomatSaus!, DEFAULT_STORES)).toBe('H?')

    const nescafe = entries.find((e) => e.productName === 'Nescafe Ice Roast')
    expect(formatPurchaseChip(nescafe!, DEFAULT_STORES)).toBe('2H29')
  })

  it('round-trips exported monthly text cleanly with zero lost entries or Rp', () => {
    const { refs, entries } = buildSeedFromWifeNote('2026-11')
    const exported = exportMonthlyNoteText('2026-11', refs, entries, DEFAULT_STORES)
    const reparsed = parseMonthlyNoteText(exported, DEFAULT_STORES)
    expect(reparsed).toHaveLength(40)
    const reparsedEntries = reparsed.flatMap((l) => l.entries)
    expect(reparsedEntries).toHaveLength(64)
    expect(reparsedEntries.reduce((s, e) => s + e.price, 0)).toBe(904000)
    expect(parseMonthlyNoteText(STARTER_WIFE_NOTE, DEFAULT_STORES)).toHaveLength(40)
  })
})
