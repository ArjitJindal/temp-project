/*
  Pseudo random number generator with seed

  Source: https://stackoverflow.com/a/47593316/916330
 */

function convertToInt(number: number, max?: number): number {
  return Math.floor(number * (max ?? Number.MAX_SAFE_INTEGER))
}

export class RandomNumberGenerator {
  // seed is an integer between 0 and Number.MAX_SAFE_INTEGER
  // it is used to generate a number between 0 and 1

  private seed: number
  private number: number

  constructor(seed: number = 0.1) {
    this.seed = seed
    this.number = RandomNumberGenerator.generateNumber(seed)
  }

  setSeed(seed: number = 0): void {
    this.seed = seed
    this.number = RandomNumberGenerator.generateNumber(seed)
  }

  getSeed(): number {
    return this.seed
  }

  r(n: number): RandomNumberGenerator {
    // randomize the seed n times and return a new RandomNumberGenerator
    // use the random output to reseed n times and return a new RandomNumberGenerator
    // NOTE: it's possible to cache the result of this function to improve performance
    //       should explore memoization (perhaps combined with recursion?) in the future

    let seed = this.seed
    for (let i = 0; i < n; i++) {
      seed = convertToInt(RandomNumberGenerator.generateNumber(seed))
    }
    return new RandomNumberGenerator(seed)
  }

  private static generateNumber(seed: number): number {
    let t = seed + 0x6d2b79f5
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }

  next(): number {
    this.seed = (this.seed + 1) % Number.MAX_SAFE_INTEGER
    this.number = RandomNumberGenerator.generateNumber(this.seed)
    return this.number
  }

  randomNumber(): number {
    // return this.next();
    // return RandomNumberGenerator.generateNumber(this.seed)
    return this.number
  }

  randomInt(max?: number): number {
    return convertToInt(this.randomNumber(), max)
  }

  randomIntInclusive(min: number, max: number): number {
    min = Math.ceil(min)
    max = Math.floor(max)
    return Math.floor(this.randomNumber() * (max - min + 1)) + min
  }

  randomFloat(max?: number): number {
    return this.randomNumber() * (max || 1)
  }

  randomBool(): boolean {
    return this.randomNumber() < 0.5
  }

  pickRandom<T>(variants: T[]): T {
    // return undefined if variants is empty
    if (variants.length === 0) {
      throw new Error('variants array is empty')
    }
    const index = this.randomInt(variants.length)
    return variants[index]
  }

  randomSubset<T>(variants: T[]): T[] {
    // return empty array if variants is empty
    if (variants.length === 0) {
      return []
    }

    const output = [...variants]
    const seed = convertToInt(this.number)
    let number = RandomNumberGenerator.generateNumber(seed)
    const index = convertToInt(number, output.length)

    for (let i = 0; i < index; i++) {
      number = RandomNumberGenerator.generateNumber(seed + i + 1)
      const selected = convertToInt(number, output.length)
      output.splice(selected, 1)
    }

    return output
  }

  randomSubsetOfSize<T>(variants: T[], size: number): T[] {
    // return empty array if variants is empty
    if (variants.length === 0) {
      return []
    }

    const output: T[] = []
    const seed = convertToInt(this.number)

    for (let i = 0; i < size; i++) {
      const number = RandomNumberGenerator.generateNumber(seed + i + 1)
      const selected = convertToInt(number, variants.length)
      output.push(variants[selected])
    }

    return output
  }

  randomTimestamp = (
    backTo = 3600 * 30 * 24 * 1000, // Seed for the last 30 days
    ref?: Date
  ) => {
    // if ref is provided, use it as the reference date else take the current date
    const refDate = ref ?? new Date()
    return refDate.getTime() - Math.round(this.randomNumber() * backTo)
  }

  randomString(len?: number): string {
    len = len ?? 5 + this.randomInt(20)
    return [...new Array(len)]
      .map((_, i) =>
        Math.floor(this.r(i + 1).randomInt(256))
          .toString(16)
          .toUpperCase()
          .padStart(2, '0')
      )
      .join('')
  }

  randomGuid(): string {
    return [
      [...new Array(4)],
      [...new Array(2)],
      [...new Array(2)],
      [...new Array(6)],
    ]
      .map((arr) =>
        arr
          .map((_, i) =>
            Math.floor(this.r(i + 1).randomInt(255))
              .toString(16)
              .toUpperCase()
              .padStart(2, '0')
          )
          .join('')
      )
      .join('-')
  }

  static generateWithSeed(seed: number): number {
    return RandomNumberGenerator.generateNumber(seed)
  }
}
