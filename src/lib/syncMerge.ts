/**
 * Conflict-free 3-way item-level merge for BelanjaSayang synced arrays.
 *
 * Compares (base, local, remote) by stable item identity so simultaneous edits
 * on two devices (e.g. husband checks off Telur while wife adds Susu or edits Ayam)
 * merge cleanly instead of overwriting each other with whole-array Last-Write-Wins.
 */

export interface MergeableRecord {
  id?: string
  normalizedName?: string
  updatedAt?: number
  createdAt?: number
  purchasedAt?: number
}

function getRecordKey(item: MergeableRecord): string | null {
  if (typeof item.id === 'string' && item.id.length > 0) return item.id
  if (
    typeof item.normalizedName === 'string' &&
    item.normalizedName.length > 0
  ) {
    return item.normalizedName
  }
  return null
}

function getTimestamp(item: MergeableRecord): number {
  return item.updatedAt ?? item.purchasedAt ?? item.createdAt ?? 0
}

/**
 * Fast structural deep equality without JSON.stringify string allocations.
 * Used both inside 3-way merge and to skip redundant state/localStorage writes on sync.
 */
export function deepEqual(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true
  if (
    a === null ||
    b === null ||
    typeof a !== 'object' ||
    typeof b !== 'object'
  ) {
    return false
  }

  const isArrA = Array.isArray(a)
  if (isArrA !== Array.isArray(b)) return false

  if (isArrA) {
    const arrA = a as unknown[]
    const arrB = b as unknown[]
    if (arrA.length !== arrB.length) return false
    for (let i = 0; i < arrA.length; i++) {
      if (!deepEqual(arrA[i], arrB[i])) return false
    }
    return true
  }

  const objA = a as Record<string, unknown>
  const objB = b as Record<string, unknown>
  const keysA = Object.keys(objA)
  const keysB = Object.keys(objB)

  // Count defined keys so { foo: undefined } matches {}
  let definedA = 0
  for (let i = 0; i < keysA.length; i++) {
    const k = keysA[i]
    const vA = objA[k]
    if (vA === undefined) continue
    definedA++
    if (!deepEqual(vA, objB[k])) return false
  }

  let definedB = 0
  for (let i = 0; i < keysB.length; i++) {
    if (objB[keysB[i]] !== undefined) definedB++
  }

  return definedA === definedB
}

function recordsEqual(a: unknown, b: unknown): boolean {
  return deepEqual(a, b)
}

export function mergeCollectionArrays<T extends MergeableRecord>(
  base: T[] | null | undefined,
  local: T[],
  remote: T[],
): { merged: T[]; localNeedsPush: boolean } {
  // Without a prior synced baseline (e.g. brand-new device initial pull), trust remote
  if (!base) {
    return { merged: remote, localNeedsPush: false }
  }

  const baseMap = new Map<string, T>()
  const localMap = new Map<string, T>()
  const remoteMap = new Map<string, T>()
  const orderedKeys: string[] = []
  const seenKeys = new Set<string>()

  const pushKey = (k: string) => {
    if (!seenKeys.has(k)) {
      seenKeys.add(k)
      orderedKeys.push(k)
    }
  }

  for (const item of base) {
    const k = getRecordKey(item)
    if (k) baseMap.set(k, item)
  }
  for (const item of remote) {
    const k = getRecordKey(item)
    if (k) {
      remoteMap.set(k, item)
      pushKey(k)
    }
  }
  for (const item of local) {
    const k = getRecordKey(item)
    if (k) {
      localMap.set(k, item)
      pushKey(k)
    }
  }

  const merged: T[] = []
  let localNeedsPush = false

  for (const key of orderedKeys) {
    const b = baseMap.get(key)
    const l = localMap.get(key)
    const r = remoteMap.get(key)

    if (l && r) {
      if (recordsEqual(l, r)) {
        merged.push(r)
      } else if (b && recordsEqual(r, b)) {
        // Only local modified this item
        merged.push(l)
        localNeedsPush = true
      } else if (b && recordsEqual(l, b)) {
        // Only remote modified this item
        merged.push(r)
      } else {
        // Both sides modified this item: prefer newer timestamp (tie -> remote)
        const lTs = getTimestamp(l)
        const rTs = getTimestamp(r)
        if (lTs > rTs) {
          merged.push(l)
          localNeedsPush = true
        } else {
          merged.push(r)
        }
      }
    } else if (l && !r) {
      if (b) {
        // Existed in base, removed on remote -> accept remote deletion
        // unless local modified it after base
        if (!recordsEqual(l, b)) {
          merged.push(l)
          localNeedsPush = true
        }
      } else {
        // Brand-new local addition -> preserve and push to cloud
        merged.push(l)
        localNeedsPush = true
      }
    } else if (!l && r) {
      if (b) {
        // Existed in base, deleted locally -> preserve local deletion
        if (recordsEqual(r, b)) {
          localNeedsPush = true
        } else {
          // Remote modified it after base -> keep remote update
          merged.push(r)
        }
      } else {
        // Brand-new remote addition -> accept into local
        merged.push(r)
      }
    }
  }

  return { merged, localNeedsPush }
}
