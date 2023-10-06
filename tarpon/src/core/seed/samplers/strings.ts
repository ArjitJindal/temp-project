import { randomInt } from '@/core/seed/samplers/prng'

export function sampleString(): string {
  return [...new Array(5 + Math.floor(randomInt(20)))]
    .map(() =>
      Math.floor(randomInt(256)).toString(16).toUpperCase().padStart(2, '0')
    )
    .join('')
}
