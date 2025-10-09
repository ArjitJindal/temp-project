import { BadRequest } from 'http-errors'
import { Tag } from '@/@types/openapi-public/Tag'
import dayjs from '@/utils/dayjs'

export const assertValidTimestampTags = (tags: Tag[] | undefined) => {
  if (!tags) {
    return true
  }
  for (const tag of tags) {
    if (tag.isTimestamp) {
      const timestamp = Number(tag.value)
      if (isNaN(timestamp) || !dayjs(timestamp).isValid()) {
        throw new BadRequest(`Invalid timestamp value for tag key: ${tag.key}`)
      }
    }
  }
  return true
}
