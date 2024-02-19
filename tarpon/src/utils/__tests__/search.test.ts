import { scoreObjects } from '../search'

describe('scoreObjects', () => {
  test('should return empty array when input is empty', () => {
    const array: object[] = []
    const query = ''
    const weightsObject = {}
    const options = { minimumThreshold: 0 }
    expect(scoreObjects(array, query, weightsObject, options)).toStrictEqual([])
  })

  test('should calculate scores for each object in the array', () => {
    const array = [
      { name: 'John Doe', age: 30, tags: ['tag1', 'tag2'] },
      { name: 'Jane Smith', age: 25, tags: ['tag2', 'tag3'] },
      { name: 'Bob Johnson', age: 40, tags: ['tag1', 'tag3'] },
    ]
    const query = 'John Doe'
    const weightsObject = { name: 100, tags: 25 }
    const options = { minimumThreshold: 50 }
    const expected = [
      {
        object: { name: 'John Doe', age: 30, tags: ['tag1', 'tag2'] },
      },
      {
        object: { name: 'Jane Smith', age: 25, tags: ['tag2', 'tag3'] },
      },
      {
        object: { name: 'Bob Johnson', age: 40, tags: ['tag1', 'tag3'] },
      },
    ]
    const scores = scoreObjects(array, query, weightsObject, options)
    expect(scores).toMatchObject(expected)
    expect(scores[0].percentage).toBeGreaterThan(100)
    expect(scores[1].percentage).toBeLessThanOrEqual(0)
    expect(scores[2].percentage).toBeLessThanOrEqual(0)
  })

  // Add more test cases as needed...
})
