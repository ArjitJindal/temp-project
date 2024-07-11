import { memoize } from 'lodash'
import { getAddress } from '../data/address'
import { Address } from '@/@types/openapi-public/Address'
import { pickRandom, randomInt } from '@/core/seed/samplers/prng'

const ADDRESS_USAGE = new Map<string, number>()

/**
 * This function is made to prevent same address for multiple users
 * This is not a perfect solution, but it should be good enough\
 * This is done to make entity linking data cleaner
 *
 * @returns random address
 */
export const randomAddress = () => {
  const randomAddress = pickRandom(addresses())
  const usage = ADDRESS_USAGE.get(randomAddress.addressLines[0]) ?? 0
  ADDRESS_USAGE.set(randomAddress.addressLines[0], usage + 1)
  const index = addresses().indexOf(randomAddress)
  if (usage + 1 >= 3) {
    addresses().splice(index, 1)
  }
  return randomAddress
}

const paymentAddresses: () => Address[] = memoize(() => {
  return [...Array(5000)].map(() => {
    return getAddress()
  })
})

export const randomPaymentAddress = () => {
  return pickRandom(paymentAddresses())
}

const streets = memoize(() => [
  'Maple Avenue',
  'Chestnut Street',
  'Willow Lane',
  'Pinecrest Drive',
  'Oakwood Court',
  'Hickory Lane',
  'Birch Street',
  'Sycamore Avenue',
  'Cedar Lane',
  'Elmwood Drive',
  'Magnolia Street',
  'Aspen Court',
  'Juniper Lane',
  'Poplar Avenue',
  'Redwood Street',
  'Beechwood Drive',
  'Spruce Lane',
  'Walnut Avenue',
  'Cherry Street',
  'Rosewood Court',
  'Acacia Lane',
  'Cypress Street',
  'Mulberry Drive',
  'Cottonwood Avenue',
  'Cactus Lane',
  'Bamboo Street',
  'Sage Court',
  'Fernwood Drive',
  'Palm Lane',
  'Vine Street',
  'Heather Avenue',
  'Daisy Court',
  'Lilac Lane',
  'Tulip Street',
  'Ivy Avenue',
  'Dandelion Lane',
  'Lavender Court',
  'Sunflower Drive',
  'Meadow Lane',
  'Orchard Street',
  'Rose Lane',
  'Alder Avenue',
  'Thistle Court',
  'Wisteria Lane',
  'Daffodil Street',
  'Holly Avenue',
  'Magnolia Court',
  'Willow Street',
  'Bluebell Lane',
])

const addresses: () => Address[] = memoize(() => {
  return [...Array(20000)].map(() => {
    return getAddress()
  })
})

export const postCodes: () => number[] = memoize(() => {
  return [...Array(5000)].map(() => randomInt(100000) + 100000)
})

export const mapAddressLineAndPostcode: () => Record<string, string> = memoize(
  () => {
    return postCodes().reduce(
      (acc, postcode) => ({
        ...acc,
        [postcode]: `${randomInt(4000) + 1} ${pickRandom(
          streets()
        )} ${pickRandom(streets())}`,
      }),
      {}
    )
  }
)

export const phoneNumber: () => string[] = memoize(() => {
  return [...Array(1000)].map(() =>
    (Math.floor(randomInt(1000000000)) + 1000000000).toString()
  )
})
