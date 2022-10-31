import { Tag } from '@/@types/openapi-internal/Tag'

export const sampleTag = (seed: number): Tag => {
  return {
    key: `test_tag_${seed}`,
    value: `Test tag #${seed}`,
  }
}
