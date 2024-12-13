import { memoize } from 'lodash'
import { getCountriesData, streets } from '../data/address'
import { BaseSampler } from './base'
import { RandomNumberGenerator } from '@/core/seed/samplers/prng'
import { Address } from '@/@types/openapi-public/Address'

export const phoneNumber: () => string[] = memoize(() => {
  const rng = new RandomNumberGenerator(42)

  return [...Array(1000)].map(() =>
    (Math.floor(rng.randomInt(1000000000)) + 1000000000).toString()
  )
})

export class AddressSampler extends BaseSampler<Address> {
  generateSample(): Address {
    const rngStreet1 = new RandomNumberGenerator(this.rng.randomInt() + 1)
    const rngStreet2 = new RandomNumberGenerator(this.rng.randomInt() + 2)

    const country = this.rng.pickRandom(Object.keys(getCountriesData()))
    const state = this.rng.pickRandom(Object.keys(getCountriesData()[country]))
    const postcode = this.rng.randomInt(100000) + 100000
    const addressLine = `${
      this.rng.randomInt(4000) + 1
    } ${rngStreet1.pickRandom(streets())} ${rngStreet2.pickRandom(streets())}`
    return {
      addressLines: [addressLine],
      postcode: String(postcode),
      city: this.rng.pickRandom(getCountriesData()[country][state]),
      state,
      country,
    }
  }
}

/**
 * This function is made to prevent same address for multiple users
 * This is not a perfect solution, but it should be good enough\
 * This is done to make entity linking data cleaner
 *
 * @returns random address
 */

export class AddressWithUsageSampler extends AddressSampler {
  addressUsage: Map<string, number>

  constructor(seed: number, counter?: number) {
    super(seed, counter)
    this.addressUsage = new Map<string, number>()
  }

  generateSample(): Address {
    let retries = 0
    while (retries < 10) {
      const address = super.generateSample()
      const usage = this.addressUsage.get(address.addressLines[0]) ?? 0
      if (usage < 3) {
        this.addressUsage.set(address.addressLines[0], usage + 1)
        return address
      }
      // shuffle the seed to avoid infinite loop
      this.rng.setSeed(this.rng.randomInt())
      retries++
    }
    throw new Error(
      'Could not find an address with usage count <= 3 after 10 retries'
    )
  }
}

export const usersAddresses: () => Address[] = memoize(() => {
  const sampler = new AddressWithUsageSampler(201)
  return [...Array(1000)].map(() => {
    return sampler.getSample()
  })
})
