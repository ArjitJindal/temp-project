import { pickRandomDeterministic } from '@/core/seed/samplers/prng'
import { addresses } from '@/core/seed/data/address'

export const randomAddress = () => {
  return pickRandomDeterministic(addresses)
}
