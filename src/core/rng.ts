/**
 * Deterministic pseudo-randomness. The same seed must always rebuild exactly
 * the same store — demos are reproducible and shareable by seed alone.
 */

export type Rng = () => number

/** mulberry32 — small, fast, good enough distribution for generated data. */
export function mulberry32(seed: number): Rng {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Uniform float in [min, max). */
export const range = (rng: Rng, min: number, max: number): number =>
  min + rng() * (max - min)

/** Uniform integer in [min, max] inclusive. */
export const rangeInt = (rng: Rng, min: number, max: number): number =>
  Math.floor(range(rng, min, max + 1))

export const pick = <T>(rng: Rng, items: readonly T[]): T =>
  items[Math.floor(rng() * items.length)]

export function chance(rng: Rng, probability: number): boolean {
  return rng() < probability
}

/** Box-Muller normal sample, clamped to keep generated dimensions sane. */
export function gauss(rng: Rng, mean: number, stdDev: number): number {
  const u = Math.max(rng(), Number.EPSILON)
  const v = rng()
  return mean + stdDev * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)
}

/**
 * Pareto-ish weight for rank `i` of `n` items: heavy head, long tail, so a
 * fifth of the catalogue carries most of the volume like a real category does.
 */
export function paretoWeight(i: number, n: number, alpha = 1.4): number {
  return Math.pow((i + 1) / n, -alpha)
}

/** Fisher-Yates, seeded. Returns a new array. */
export function shuffle<T>(rng: Rng, items: readonly T[]): T[] {
  const out = items.slice()
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}
