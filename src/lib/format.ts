const idrFormatter = new Intl.NumberFormat('id-ID')

export function formatRupiah(amount: number): string {
  const safe = Number.isFinite(amount) ? Math.max(0, Math.round(amount)) : 0
  return `Rp ${idrFormatter.format(safe)}`
}

/**
 * Extracts a safe non-negative integer Rupiah value from any formatted or raw input string
 * (e.g. "Rp 15.000" -> 15000, "125.500" -> 125500, "" -> 0).
 */
export function parseIdrInput(raw: string): number {
  const digits = raw.replace(/[^\d]/g, '')
  if (!digits) return 0
  const num = Number(digits)
  return Number.isFinite(num) ? Math.max(0, Math.round(num)) : 0
}

/**
 * Formats a Rupiah number or raw digit string with Indonesian thousand dots
 * for live currency inputs (e.g. 15000 -> "15.000", "1250000" -> "1.250.000", 0 -> "").
 */
export function formatIdrInput(value: number | string): string {
  const num =
    typeof value === 'number'
      ? Number.isFinite(value)
        ? Math.max(0, Math.round(value))
        : 0
      : parseIdrInput(value)
  if (num <= 0) return ''
  return idrFormatter.format(num)
}

export function normalizeItemName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, ' ')
}

export function triggerHaptic(durationMs = 15): void {
  if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
    try {
      navigator.vibrate(durationMs)
    } catch {
      // Ignore on browsers that block vibration
    }
  }
}

export function generateId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

/**
 * Lightweight deterministic hash for local PIN verification so the raw PIN
 * is not stored in plain text in localStorage while staying synchronous & offline.
 */
export function hashPin(pin: string): string {
  const salted = `BelanjaSayang::v1::${pin}`
  let h1 = 0xdeadbeef ^ salted.length
  let h2 = 0x41c6ce57 ^ salted.length
  for (let i = 0; i < salted.length; i++) {
    const ch = salted.charCodeAt(i)
    h1 = Math.imul(h1 ^ ch, 2654435761)
    h2 = Math.imul(h2 ^ ch, 1597334677)
  }
  h1 =
    Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^
    Math.imul(h2 ^ (h2 >>> 13), 3266489909)
  h2 =
    Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^
    Math.imul(h1 ^ (h1 >>> 13), 3266489909)
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16)
}
