import { pickRandom } from '@/core/seed/samplers/prng'
import { addresses } from '@/core/seed/data/address'

export const randomAddress = () => {
  return pickRandom(addresses)
}
