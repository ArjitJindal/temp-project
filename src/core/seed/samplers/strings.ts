import { prng } from '@/utils/prng'

export function sampleString(seed?: number | undefined): string {
  const random = prng(seed)
  return [...new Array(5 + Math.floor(random() * 20))]
    .map(() =>
      Math.floor(random() * 256)
        .toString(16)
        .toUpperCase()
        .padStart(2, '0')
    )
    .join('')
}
