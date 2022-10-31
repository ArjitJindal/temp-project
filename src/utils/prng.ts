/*
  Pseudo random number generator with seed

  Source: https://stackoverflow.com/a/47593316/916330
 */
export function prng(seed?: number | undefined | null) {
  let state = (seed ?? Math.random()) * 10
  // mulberry32
  return function () {
    let t = (state += 0x6d2b79f5)
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function randomInt(seed?: number | undefined | null, max?: number) {
  const number = prng(seed)()
  return Math.floor(number * (max ?? Number.MAX_SAFE_INTEGER))
}
