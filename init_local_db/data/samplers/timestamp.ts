import { prng } from '@/utils/prng'

export const sampleTimestamp = (seed?: number | undefined) => {
  return 1666796070504 - Math.round(prng(seed)() * 3600 * 24 * 1000)
}
