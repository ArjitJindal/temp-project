import { getAddedItems } from '../array'

describe('getAddedItems', () => {
  it('should return empty array when no items added', () => {
    expect(getAddedItems(['a', 'b'], ['a', 'b'])).toEqual([])
    expect(getAddedItems([], [])).toEqual([])
  })

  it('should return added items when new items present', () => {
    expect(getAddedItems(['a'], ['a', 'b'])).toEqual(['b'])
    expect(getAddedItems([], ['a', 'b'])).toEqual(['a', 'b'])
  })

  it('should handle duplicate items', () => {
    expect(getAddedItems(['a'], ['a', 'a'])).toEqual(['a'])
    expect(getAddedItems(['a', 'a'], ['a', 'a', 'a'])).toEqual(['a'])
  })

  it('should handle removed items', () => {
    expect(getAddedItems(['a', 'b'], ['b'])).toEqual([])
    expect(getAddedItems(['a', 'a'], ['a'])).toEqual([])
  })

  it('should handle mixed additions and removals', () => {
    expect(getAddedItems(['a', 'b'], ['b', 'c'])).toEqual(['c'])
    expect(getAddedItems(['a', 'a', 'b'], ['a', 'b', 'b'])).toEqual(['b'])
  })
})
