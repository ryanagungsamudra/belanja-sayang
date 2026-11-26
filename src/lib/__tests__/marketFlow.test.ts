import { describe, expect, it } from 'vitest'
import { buildBackupSnapshot, parseBackupSnapshot } from '../backup'
import { hashPin } from '../format'
import {
  buildSeedFromWifeNote,
  exportMonthlyNoteText,
  parseMonthlyNoteText,
} from '../noteParser'
import { DEFAULT_CATEGORIES, DEFAULT_STORES } from '../stores'
import { deepEqual, mergeCollectionArrays } from '../syncMerge'

describe('End-to-End Household Data Flows', () => {
  it('preserves full 40-item monthly catalog through note export -> import -> JSON backup -> restore', () => {
    const seed = buildSeedFromWifeNote('2026-11')
    expect(seed.refs.length).toBe(40)
    expect(seed.entries.length).toBe(64)

    const total = seed.entries.reduce((s, e) => s + e.price, 0)
    expect(total).toBe(904000)

    const exportedNote = exportMonthlyNoteText(
      '2026-11',
      seed.refs,
      seed.entries,
      DEFAULT_STORES,
    )
    const reParsed = parseMonthlyNoteText(exportedNote, DEFAULT_STORES)
    const reParsedTotal = reParsed.reduce(
      (sum, line) => sum + line.entries.reduce((s, e) => s + e.price, 0),
      0,
    )
    expect(reParsed.length).toBe(40)
    expect(reParsedTotal).toBe(904000)

    const backup = buildBackupSnapshot({
      stores: DEFAULT_STORES,
      categories: DEFAULT_CATEGORIES,
      productRefs: seed.refs,
      monthlyPurchases: seed.entries,
      items: [],
      templates: [],
      frequentItems: [],
      monthlyBudget: 1200000,
    })
    const restored = parseBackupSnapshot(JSON.stringify(backup))
    expect(restored.error).toBeNull()
    expect(restored.snapshot?.monthlyPurchases.length).toBe(64)
    expect(deepEqual(restored.snapshot?.productRefs, seed.refs)).toBe(true)
  })

  it('merges two phones editing different items concurrently without data loss', () => {
    const base = [
      { id: 'item-1', name: 'Telur', isBought: false, updatedAt: 100 },
      { id: 'item-2', name: 'Ayam', isBought: false, updatedAt: 100 },
    ]
    // Phone A checks off Telur and adds Susu
    const local = [
      { id: 'item-1', name: 'Telur', isBought: true, updatedAt: 200 },
      { id: 'item-2', name: 'Ayam', isBought: false, updatedAt: 100 },
      { id: 'item-3', name: 'Susu', isBought: false, updatedAt: 210 },
    ]
    // Phone B checks off Ayam and adds Tomat
    const remote = [
      { id: 'item-1', name: 'Telur', isBought: false, updatedAt: 100 },
      { id: 'item-2', name: 'Ayam', isBought: true, updatedAt: 205 },
      { id: 'item-4', name: 'Tomat', isBought: false, updatedAt: 215 },
    ]

    const { merged, localNeedsPush } = mergeCollectionArrays(
      base,
      local,
      remote,
    )
    expect(localNeedsPush).toBe(true)
    expect(merged.length).toBe(4)
    expect(merged.find((i) => i.id === 'item-1')?.isBought).toBe(true)
    expect(merged.find((i) => i.id === 'item-2')?.isBought).toBe(true)
    expect(merged.some((i) => i.id === 'item-3')).toBe(true)
    expect(merged.some((i) => i.id === 'item-4')).toBe(true)
  })

  it('keeps PIN hashing deterministic and backwards-compatible', () => {
    const h1 = hashPin('1234')
    const h2 = hashPin('1234')
    const h3 = hashPin('4321')
    expect(h1).toBe(h2)
    expect(h1).not.toBe(h3)
    expect(h1.length).toBeGreaterThan(8)
  })
})
