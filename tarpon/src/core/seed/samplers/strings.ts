import { randomIntDeterministic } from '@/core/seed/samplers/prng'

export function sampleString(): string {
  return [...new Array(5 + Math.floor(randomIntDeterministic(20)))]
    .map(() =>
      Math.floor(randomIntDeterministic(256))
        .toString(16)
        .toUpperCase()
        .padStart(2, '0')
    )
    .join('')
}
