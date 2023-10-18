import { pickRandom } from '@/core/seed/samplers/prng'
import { addresses } from '@/core/seed/data/address'

const ADDRESSES = addresses
const ADDRESS_USAGE = new Map<string, number>()
export const randomAddress = () => {
  const randomAddress = pickRandom(ADDRESSES)
  const usage = ADDRESS_USAGE.get(randomAddress.addressLines[0]) ?? 0
  ADDRESS_USAGE.set(randomAddress.addressLines[0], usage + 1)
  const index = ADDRESSES.indexOf(randomAddress)
  if (usage + 1 >= 3) {
    ADDRESSES.splice(index, 1)
  }
  return randomAddress
}
