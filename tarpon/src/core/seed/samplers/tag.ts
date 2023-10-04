import { Tag } from '@/@types/openapi-internal/Tag'
import { pickRandomDeterministic } from '@/core/seed/samplers/prng'

const entityValues = ['Capital Markets', 'Securities', 'Onshore', 'Offshore']

export const sampleTag = (): Tag => {
  return {
    key: `entity`,
    value: pickRandomDeterministic(entityValues),
  }
}
