import { describe, expect, it } from 'vitest'
import { detectCategory } from '../categories'

describe('detectCategory', () => {
  it('avoids substring false-positives like santan inside Jeruk Santang', () => {
    expect(detectCategory('Jeruk Santang')).toBe('Sayur & Buah')
    expect(detectCategory('Santan Kara')).toBe('Bumbu & Rempah')
  })

  it('prioritizes Bumbu & Rempah over meat/fish words in seasoning names', () => {
    expect(detectCategory('Kaldu Ayam Masako')).toBe('Bumbu & Rempah')
    expect(detectCategory('Terasi Udang ABC')).toBe('Bumbu & Rempah')
    expect(detectCategory('Kecap Ikan')).toBe('Bumbu & Rempah')
    expect(detectCategory('Saus Tiram Leekumkee')).toBe('Bumbu & Rempah')
  })

  it('classifies proteins, produce, and staples accurately', () => {
    expect(detectCategory('Ayam')).toBe('Daging & Ikan')
    expect(detectCategory('Sosis Champ Ayam')).toBe('Daging & Ikan')
    expect(detectCategory('Sarden Kingfish')).toBe('Daging & Ikan')
    expect(detectCategory('Kangkung')).toBe('Sayur & Buah')
    expect(detectCategory('Jamur Tiram')).toBe('Sayur & Buah')
    expect(detectCategory('Telur')).toBe('Sembako')
    expect(detectCategory('Minyak 2L')).toBe('Sembako')
    expect(detectCategory('Gulaku')).toBe('Sembako')
    expect(detectCategory('Barang Misterius XYZ')).toBe('Lainnya')
  })
})
