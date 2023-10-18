import { pickRandom, randomInt } from '@/core/seed/samplers/prng'
import { Address } from '@/@types/openapi-internal/Address'

const streets = [
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
]

const countries = {
  'United States': {
    'New York': ['New York City', 'Buffalo'],
    California: ['Los Angeles', 'San Francisco'],
  },
  Canada: {
    Ontario: ['Toronto', 'Ottawa'],
    Quebec: ['Montreal', 'Quebec City'],
  },
  'United Kingdom': {
    England: ['London', 'Manchester'],
    Scotland: ['Glasgow', 'Edinburgh'],
  },
  France: {
    'Île-de-France': ['Paris', 'Versailles'],
    "Provence-Alpes-Côte d'Azur": ['Marseille', 'Nice'],
  },
  Germany: {
    Berlin: ['Berlin'],
    Bavaria: ['Munich', 'Nuremberg'],
  },
  Spain: {
    Madrid: ['Madrid'],
    Catalonia: ['Barcelona', 'Girona'],
  },
  Italy: {
    Lazio: ['Rome', 'Latina'],
    Lombardy: ['Milan', 'Bergamo'],
  },
  Australia: {
    'New South Wales': ['Sydney', 'Newcastle'],
    Victoria: ['Melbourne', 'Geelong'],
  },
  Brazil: {
    'São Paulo': ['São Paulo', 'Campinas'],
    'Rio de Janeiro': ['Rio de Janeiro', 'Niterói'],
  },
  India: {
    Maharashtra: ['Mumbai', 'Pune'],
    Delhi: ['New Delhi'],
  },
  China: {
    Beijing: ['Beijing'],
    Shanghai: ['Shanghai'],
  },
  Japan: {
    Kanto: ['Tokyo', 'Yokohama'],
    Kansai: ['Osaka', 'Kyoto'],
  },
  'South Korea': {
    Seoul: ['Seoul'],
    Busan: ['Busan'],
  },
  Mexico: {
    'Mexico City': ['Mexico City'],
    Jalisco: ['Guadalajara'],
  },
}

const postCodes = [...Array(5000)].map(() => randomInt(100000) + 100000)

const mapAddressLineAndPostcode = postCodes.reduce(
  (acc, postcode) => ({
    ...acc,
    [postcode]: `${randomInt(4000) + 1} ${pickRandom(streets)} ${pickRandom(
      streets
    )}`,
  }),
  {}
)

const getAddress = (): Address => {
  const country = pickRandom(Object.keys(countries))
  const state = pickRandom(Object.keys(countries[country]))
  const postcode = pickRandom(postCodes)
  const addressLine = mapAddressLineAndPostcode[postcode]
  return {
    addressLines: [addressLine],
    postcode: String(postcode),
    city: pickRandom(countries[country][state]),
    state,
    country,
  }
}

export const addresses: Address[] = [...Array(20000)].map(() => {
  return getAddress()
})

export const paymentAddresses = [...Array(1000)].map(() => {
  return getAddress()
})

export const phoneNumber = [...Array(1000)].map(() =>
  (Math.floor(randomInt(1000000000)) + 1000000000).toString()
)
