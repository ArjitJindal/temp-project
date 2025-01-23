import { RandomNumberGenerator } from './prng'
import dayjs from '@/utils/dayjs'

export abstract class BaseSampler<T> {
  protected rng: RandomNumberGenerator
  protected counter: number

  constructor(
    seed: number = Math.random() * Number.MAX_SAFE_INTEGER,
    counter?: number
  ) {
    this.rng = new RandomNumberGenerator(seed)
    this.counter = counter ?? 1
  }

  protected abstract generateSample(...args: any[]): T

  public getSample(seed?: number, ...args: any[]): T {
    if (seed !== undefined) {
      this.rng.setSeed(seed)
    }
    const sample = this.generateSample(...args)
    this.counter++
    this.rng.next()
    return sample
  }

  public setRandomSeed(seed: number): void {
    this.rng.setSeed(seed)
  }

  // TODO: move timestamp sampling to a separate TimestampSampler class
  protected sampleTimestamp(
    backTo: number = 3600 * 30 * 24 * 1000 // seed for the last 30 days
  ): number {
    return Date.now() - Math.round(this.rng.randomNumber() * backTo)
  }

  protected generateRandomTimestamp(
    yearDifference: number = 0,
    minDate: string = '1947-01-01'
  ): number {
    const maxDate = dayjs()
      .subtract(yearDifference, 'year')
      .format('YYYY-MM-DD')

    const min = dayjs(minDate).valueOf()
    const max = dayjs(maxDate).valueOf()
    const timestamp = this.rng.randomFloat() ** 2 * (max - min) + min

    return timestamp
  }
}
