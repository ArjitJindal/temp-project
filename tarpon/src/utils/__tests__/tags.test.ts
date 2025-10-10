import { BadRequest } from 'http-errors'
import { assertValidTimestampTags } from '../tags'

type Tag = {
  key: string
  value: string
  isTimestamp?: boolean
}

describe('assertValidTimestampTags', () => {
  it('should return true if no tags are passed', () => {
    expect(assertValidTimestampTags([])).toBe(true)
  })

  it('should return true if there are no timestamp tags', () => {
    const tags: Tag[] = [
      { key: 'foo', value: 'bar', isTimestamp: false },
      { key: 'id', value: '123' },
    ]
    expect(assertValidTimestampTags(tags)).toBe(true)
  })

  it('should return true for valid timestamp tag values', () => {
    const validTs = Date.now()
    const tags: Tag[] = [
      { key: 'createdAt', value: String(validTs), isTimestamp: true },
      { key: 'other', value: 'random' },
    ]
    expect(assertValidTimestampTags(tags)).toBe(true)
  })

  it('should throw BadRequest for non-numeric timestamp', () => {
    const tags: Tag[] = [
      { key: 'createdAt', value: 'not-a-number', isTimestamp: true },
    ]
    expect(() => assertValidTimestampTags(tags)).toThrow(BadRequest)
    expect(() => assertValidTimestampTags(tags)).toThrow(
      /Invalid timestamp value for tag key: createdAt/
    )
  })

  it('should throw BadRequest for numeric but invalid timestamp', () => {
    const tags: Tag[] = [
      {
        key: 'createdAt',
        value: String(Number.MAX_SAFE_INTEGER),
        isTimestamp: true,
      },
    ]
    expect(() => assertValidTimestampTags(tags)).toThrow(BadRequest)
  })

  it('should validate multiple tags and throw only for the invalid one', () => {
    const tags: Tag[] = [
      { key: 'createdAt', value: String(Date.now()), isTimestamp: true },
      { key: 'updatedAt', value: 'oops', isTimestamp: true },
    ]
    expect(() => assertValidTimestampTags(tags)).toThrow(
      /Invalid timestamp value for tag key: updatedAt/
    )
  })
})
