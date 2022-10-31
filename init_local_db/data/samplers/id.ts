import { prng } from '@/utils/prng'

export function sampleGuid(seed?: number | undefined): string {
  const random = prng(seed)
  return [
    [...new Array(4)],
    [...new Array(2)],
    [...new Array(2)],
    [...new Array(6)],
  ]
    .map((arr) =>
      arr
        .map((_) =>
          Math.floor(random() * 256)
            .toString(16)
            .toUpperCase()
            .padStart(2, '0')
        )
        .join('')
    )
    .join('-')
}
