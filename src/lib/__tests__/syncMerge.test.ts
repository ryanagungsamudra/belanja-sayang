import { describe, expect, it } from 'vitest'
import { deepEqual, mergeCollectionArrays } from '../syncMerge'

interface SampleItem {
  id: string
  name: string
  isBought: boolean
  updatedAt: number
}

describe('mergeCollectionArrays (3-way item-level merge)', () => {
  it('trusts remote completely when there is no synced baseline yet', () => {
    const local: SampleItem[] = [
      { id: '1', name: 'Telur', isBought: false, updatedAt: 100 },
    ]
    const remote: SampleItem[] = [
      { id: '2', name: 'Ayam', isBought: true, updatedAt: 200 },
    ]
    const res = mergeCollectionArrays(null, local, remote)
    expect(res.merged).toEqual(remote)
    expect(res.localNeedsPush).toBe(false)
  })

  it('preserves simultaneous husband & wife edits on different items without overwrite', () => {
    const base: SampleItem[] = [
      { id: '1', name: 'Telur', isBought: false, updatedAt: 100 },
      { id: '2', name: 'Ayam', isBought: false, updatedAt: 100 },
    ]
    // Husband checks off Telur locally
    const local: SampleItem[] = [
      { id: '1', name: 'Telur', isBought: true, updatedAt: 200 },
      { id: '2', name: 'Ayam', isBought: false, updatedAt: 100 },
    ]
    // Wife checks off Ayam & adds Susu remotely
    const remote: SampleItem[] = [
      { id: '1', name: 'Telur', isBought: false, updatedAt: 100 },
      { id: '2', name: 'Ayam', isBought: true, updatedAt: 210 },
      { id: '3', name: 'Susu', isBought: false, updatedAt: 220 },
    ]

    const { merged, localNeedsPush } = mergeCollectionArrays(base, local, remote)
    expect(localNeedsPush).toBe(true)
    expect(merged).toHaveLength(3)
    expect(merged.find((i) => i.id === '1')?.isBought).toBe(true)
    expect(merged.find((i) => i.id === '2')?.isBought).toBe(true)
    expect(merged.find((i) => i.id === '3')?.name).toBe('Susu')
  })

  it('resolves concurrent edits to the same item by newest updatedAt', () => {
    const base: SampleItem[] = [
      { id: '1', name: 'Telur', isBought: false, updatedAt: 100 },
    ]
    const local: SampleItem[] = [
      { id: '1', name: 'Telur Kampung', isBought: true, updatedAt: 350 },
    ]
    const remote: SampleItem[] = [
      { id: '1', name: 'Telur Negeri', isBought: false, updatedAt: 250 },
    ]

    const { merged, localNeedsPush } = mergeCollectionArrays(base, local, remote)
    expect(localNeedsPush).toBe(true)
    expect(merged[0].name).toBe('Telur Kampung')
    expect(merged[0].isBought).toBe(true)
  })

  it('honors remote deletions and local deletions cleanly', () => {
    const base: SampleItem[] = [
      { id: '1', name: 'Telur', isBought: false, updatedAt: 100 },
      { id: '2', name: 'Ayam', isBought: false, updatedAt: 100 },
    ]
    // Local deleted Ayam and added Tempe
    const local: SampleItem[] = [
      { id: '1', name: 'Telur', isBought: false, updatedAt: 100 },
      { id: '3', name: 'Tempe', isBought: false, updatedAt: 200 },
    ]
    // Remote deleted Telur
    const remote: SampleItem[] = [
      { id: '2', name: 'Ayam', isBought: false, updatedAt: 100 },
    ]

    const { merged, localNeedsPush } = mergeCollectionArrays(base, local, remote)
    expect(localNeedsPush).toBe(true)
    expect(merged.map((i) => i.id)).toEqual(['3'])
  })

  it('compares nested structures and undefined optional keys accurately via deepEqual', () => {
    expect(deepEqual({ a: 1, b: undefined }, { a: 1 })).toBe(true)
    expect(deepEqual({ a: [1, { x: 'ok' }] }, { a: [1, { x: 'ok' }] })).toBe(true)
    expect(deepEqual({ a: [1, { x: 'no' }] }, { a: [1, { x: 'ok' }] })).toBe(false)
  })
})
