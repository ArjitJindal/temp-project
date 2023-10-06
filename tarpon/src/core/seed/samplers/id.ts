import { randomInt } from '@/core/seed/samplers/prng'

export function sampleGuid(): string {
  return [
    [...new Array(4)],
    [...new Array(2)],
    [...new Array(2)],
    [...new Array(6)],
  ]
    .map((arr) =>
      arr
        .map((_) =>
          Math.floor(randomInt(255)).toString(16).toUpperCase().padStart(2, '0')
        )
        .join('')
    )
    .join('-')
}
