/*
  Pseudo random number generator with seed

  Source: https://stackoverflow.com/a/47593316/916330
 */
let seed = 0.1

export function randomNumberGenerator() {
  let t = (seed += 0x6d2b79f5)
  t = Math.imul(t ^ (t >>> 15), t | 1)
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
  seed = (seed + 0.1) % Number.MAX_SAFE_INTEGER
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}

export function getRandomIntInclusive(min: number, max: number) {
  min = Math.ceil(min)
  max = Math.floor(max)
  return Math.floor(randomNumberGenerator() * (max - min + 1)) + min
}

export function randomInt(max?: number) {
  return Math.floor(randomNumberGenerator() * (max ?? Number.MAX_SAFE_INTEGER))
}

export function randomFloat(max?: number) {
  return randomNumberGenerator() * (max || 1)
}

export function pickRandom<T>(variants: T[]): T {
  const index = randomInt(variants.length)
  return variants[index]
}

export const randomSubset = <T>(variants: T[]): T[] => {
  const output = [...variants]
  const index = randomInt(output.length)
  for (let i = 0; i < index; i++) {
    const selected = randomInt(output.length)
    output.splice(selected, 1)
  }
  return output
}

export function randomSubsetOfSize<T>(variants: T[], size: number): T[] {
  const output: T[] = []
  for (let i = 0; i < size; i++) {
    const selected = randomInt(variants.length)
    output.push(variants[selected])
  }
  return output
}
