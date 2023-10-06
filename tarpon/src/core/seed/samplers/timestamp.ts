import { randomNumberGenerator } from './prng'

export const sampleTimestamp = (
  backTo = 3600 * 30 * 24 * 1000 // Seed for the last 30 days
) => {
  return Date.now() - Math.round(randomNumberGenerator() * backTo)
}
