import { Tag } from '@/@types/openapi-internal/Tag'
import { pickRandom } from '@/utils/prng'

const entityValues = ['Capital Markets', 'Securities', 'Onshore', 'Offshore']

export const sampleTag = (): Tag => {
  return {
    key: `entity`,
    value: pickRandom(entityValues),
  }
}
