import { pickRandom } from '@/core/seed/samplers/prng'
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

export const addresses: Address[] = [...Array(300)].map(() => {
  const country = pickRandom(Object.keys(countries))
  const state = pickRandom(Object.keys(countries[country]))

  return {
    addressLines: [
      `${Math.floor(Math.random() * 1000)} ${pickRandom(streets)}`,
    ],
    postcode: String(Math.floor(Math.random() * 100_000)),
    city: pickRandom(countries[country][state]),
    state: `California`,
    country: `USA`,
  }
})

export const phoneNumber = [...Array(300)].map(() =>
  (Math.floor(Math.random() * 9_000_000) + 10_000_000).toString()
)
