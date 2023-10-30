import { memoize } from 'lodash'
import { mapAddressLineAndPostcode, postCodes } from '../samplers/address'
import { pickRandom } from '@/core/seed/samplers/prng'
import { Address } from '@/@types/openapi-internal/Address'

const getCountriesData = memoize(() => ({
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
}))

export const getAddress = (): Address => {
  const country = pickRandom(Object.keys(getCountriesData()))
  const state = pickRandom(Object.keys(getCountriesData()[country]))
  const postcode = pickRandom(postCodes())
  const addressLine = mapAddressLineAndPostcode()[postcode]
  return {
    addressLines: [addressLine],
    postcode: String(postcode),
    city: pickRandom(getCountriesData()[country][state]),
    state,
    country,
  }
}
