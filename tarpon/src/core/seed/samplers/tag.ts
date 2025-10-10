import { BaseSampler } from './base'
import { Tag } from '@/@types/openapi-internal/Tag'

const entityValues = ['Capital Markets', 'Securities', 'Onshore', 'Offshore']

export class TagSampler extends BaseSampler<Tag> {
  protected generateSample(): Tag {
    return {
      key: `entity`,
      value: this.rng.pickRandom(entityValues),
    }
  }
}
