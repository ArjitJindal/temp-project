import { Tag } from '@/@types/openapi-internal/Tag'
import { pickRandom } from '@/core/seed/samplers/prng'

const entityValues = ['Capital Markets', 'Securities', 'Onshore', 'Offshore']

export const sampleTag = (): Tag => {
  return {
    key: `entity`,
    value: pickRandom(entityValues),
  }
}
