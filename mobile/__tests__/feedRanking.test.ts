import { rankFeed, seededNoise } from '../lib/feedRanking'

const place = (id: string, is_promoted = false, quality = 0) => ({
  id,
  is_promoted,
  quality,
})

const catalog = [
  place('resto-a', true),
  place('resto-b'),
  place('resto-c'),
  place('resto-d'),
  place('resto-e'),
  place('resto-f'),
]

const seeds = Array.from({ length: 50 }, (_, i) => `seed-${i}`)

describe('seededNoise', () => {
  it('returns values in [0, 1) and is deterministic', () => {
    for (const seed of seeds) {
      const n = seededNoise(seed, 'resto-a')
      expect(n).toBeGreaterThanOrEqual(0)
      expect(n).toBeLessThan(1)
      expect(seededNoise(seed, 'resto-a')).toBe(n)
    }
  })
})

describe('rankFeed', () => {
  it('is deterministic for a given seed (stable pagination)', () => {
    const a = rankFeed(catalog, 'seed-1', () => 0)
    const b = rankFeed(catalog, 'seed-1', () => 0)
    expect(a.map(p => p.id)).toEqual(b.map(p => p.id))
  })

  it('produces different orders across seeds (no more frozen feed)', () => {
    const orders = new Set(
      seeds.map(s => rankFeed(catalog, s, () => 0).map(p => p.id).join(','))
    )
    expect(orders.size).toBeGreaterThan(5)
  })

  it('always keeps the promoted place within the top 3', () => {
    for (const seed of seeds) {
      const pos = rankFeed(catalog, seed, () => 0).findIndex(p => p.is_promoted)
      expect(pos).toBeGreaterThanOrEqual(0)
      expect(pos).toBeLessThanOrEqual(2)
    }
  })

  it('rotates the promoted place instead of pinning it to #1', () => {
    const positions = new Set(
      seeds.map(s => rankFeed(catalog, s, () => 0).findIndex(p => p.is_promoted))
    )
    expect(positions.size).toBeGreaterThan(1)
  })

  it('never drops or duplicates places', () => {
    for (const seed of seeds) {
      const ids = rankFeed(catalog, seed, () => 0).map(p => p.id)
      expect([...ids].sort()).toEqual(catalog.map(p => p.id).sort())
    }
  })

  it('ranks high-quality places earlier on average', () => {
    const pool = [
      place('good', false, 0.7),
      ...['x1', 'x2', 'x3', 'x4', 'x5'].map(id => place(id, false, 0)),
    ]
    const avgPos =
      seeds
        .map(s => rankFeed(pool, s, p => p.quality).findIndex(p => p.id === 'good'))
        .reduce((sum, pos) => sum + pos, 0) / seeds.length
    // random baseline would average position 2.5 in a list of 6
    expect(avgPos).toBeLessThan(1.5)
  })
})
