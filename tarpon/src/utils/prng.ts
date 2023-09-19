/*
  Pseudo random number generator with seed

  Source: https://stackoverflow.com/a/47593316/916330
 */
export function prng(seed?: number | undefined | null) {
  let state = (seed ?? Math.random()) * Number.MAX_SAFE_INTEGER
  // mulberry32
  return function () {
    let t = (state += 0x6d2b79f5)
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function randomInt(seed?: number | undefined | null, max?: number) {
  return Math.floor(Math.random() * (max ?? Number.MAX_SAFE_INTEGER))
}

export function randomFloat(seed?: number | undefined | null, max?: number) {
  return Math.random() * (max || 1)
}

export function pickRandom<T>(variants: T[], seed?: number): T {
  const index = randomInt(seed ?? 0.1, variants.length)
  return variants[index]
}
export function randomSubset<T>(variants: T[], seed?: number): T[] {
  const output = [...variants]
  const index = randomInt(seed ?? 0.1, output.length)
  for (let i = 0; i < index; i++) {
    const selected = randomInt(seed ?? 0.1, output.length)
    output.splice(selected, 1)
  }
  return output
}

export function randomSubsetOfSize<T>(
  variants: T[],
  size: number,
  seed?: number
): T[] {
  const output: T[] = []
  for (let i = 0; i < size; i++) {
    const selected = randomInt(seed ?? 0.1, variants.length)
    output.push(variants[selected])
  }
  return output
}
