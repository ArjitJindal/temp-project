import { Address } from '@/@types/openapi-internal/Address'
import { pickRandom, prng } from '@/core/seed/samplers/prng'
import { addresses } from '@/core/seed/data/address'

export function sampleAddress(seed?: number): Address {
  const rnd = prng(seed)
  return pickRandom<Address>(
    [
      {
        addressLines: ['Times Square 12B', `App. 28`],
        postcode: '88173',
        city: 'New York',
        state: 'NY',
        country: 'US',
      },
      {
        addressLines: ['2227 W', `App. 12`],
        postcode: '60007',
        city: 'Chicago',
        state: 'IL',
        country: 'US',
      },
      {
        addressLines: ['4 Manor Dr.', `App. 42`],
        postcode: '10040',
        city: 'New York',
        state: 'NY',
        country: 'USA',
      },
    ],
    rnd()
  )
}

export const randomAddress = () => {
  return pickRandom(addresses)
}
