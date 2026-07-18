// Feed ranking: seeded shuffle + quality boost + rotating promoted slots.
//
// The goal is that the feed never opens in the same order twice, without
// being purely random. Every ranking is deterministic for a given seed, so
// pagination and refetches within a session are stable; the seed rotates on
// app launch and on pull-to-refresh, which deals a fresh order.

let feedSeed = generateSeed()

function generateSeed(): string {
  return Math.random().toString(36).slice(2, 10)
}

export function getFeedSeed(): string {
  return feedSeed
}

/** Deal a fresh feed order. Called on pull-to-refresh; takes effect on the next fetch. */
export function rotateFeedSeed(): void {
  feedSeed = generateSeed()
}

/** Deterministic pseudo-random number in [0, 1) from (seed, key) — FNV-1a hash. */
export function seededNoise(seed: string, key: string): number {
  const str = seed + ':' + key
  let h = 2166136261
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return (h >>> 0) / 4294967296
}

/**
 * Rank items by `quality (0..1) + seeded noise`, then re-insert promoted
 * items into a rotating slot within the top 3 — promoted places are
 * guaranteed an early position but not welded to #1.
 */
export function rankFeed<T extends { id: string; is_promoted: boolean }>(
  items: T[],
  seed: string,
  quality: (item: T) => number,
  noiseWeight = 1
): T[] {
  const scored = [...items].sort((a, b) => {
    const scoreA = quality(a) + seededNoise(seed, a.id) * noiseWeight
    const scoreB = quality(b) + seededNoise(seed, b.id) * noiseWeight
    return scoreB - scoreA
  })

  const promoted = scored.filter(p => p.is_promoted)
  const result = scored.filter(p => !p.is_promoted)

  promoted.forEach((p, i) => {
    // First three promoted places land somewhere in the top 3; any beyond
    // that (unlikely at our scale) go right after.
    const slot =
      i < 3 ? Math.floor(seededNoise(seed, p.id + ':slot') * 3) : 3 + i
    result.splice(Math.min(slot, result.length), 0, p)
  })

  return result
}
