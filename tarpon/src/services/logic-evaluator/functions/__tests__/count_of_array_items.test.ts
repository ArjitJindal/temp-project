import { NUMBER_OF_ITEMS, NUMBER_OF_OBJECTS } from '../number_of_items'

describe('count_of_array_of_items', () => {
  it('should return the length of the array', async () => {
    const x = [[1, 2, 3]]
    const result = await NUMBER_OF_ITEMS.run(x)
    expect(result).toEqual(3)
  })
  it('should return 0 for empty array for items', async () => {
    const x = [[]]
    const result = await NUMBER_OF_ITEMS.run(x)
    expect(result).toEqual(0)
  })
})
describe('count_of_array_of_objects', () => {
  it('should return the length of the array of objects', async () => {
    const x = [
      [
        { value: 1, label: '1' },
        { value: 2, label: '2' },
        { value: 3, label: '3' },
        { value: 4, label: '4' },
      ],
    ]
    const result = await NUMBER_OF_OBJECTS.run(x)
    expect(result).toEqual(4)
  })
  it('should return 0 for empty array for objects', async () => {
    const x = [[]]
    const result = await NUMBER_OF_OBJECTS.run(x)
    expect(result).toEqual(0)
  })
})
