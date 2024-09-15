import { getMongoDbClient } from '@/utils/mongodb-utils'
import { SANCTIONS_COLLECTION } from '@/utils/mongodb-definitions'
import { MongoSanctionsRepository } from '@/services/sanctions/repositories/sanctions-repository' // Adjust the path

describe('MongoSanctionsRepository', () => {
  let collection: any

  beforeAll(async () => {
    // Connect to an in-memory or test MongoDB instance
    const mongoDb = await getMongoDbClient()
    collection = mongoDb.db().collection(SANCTIONS_COLLECTION)
    await collection.createIndex(
      { provider: 1, id: 1, version: 1 }, // Define the fields for the index
      { unique: true } // Enforce uniqueness
    )
    // Seed the database with test data
    await collection.insertMany([
      { provider: 'dowjones', version: '24-08', id: '1', name: 'Tim' },
      { provider: 'dowjones', version: '24-08', id: '2', name: 'Bob' },
      { provider: 'dowjones', version: '24-08', id: '3', name: 'Sam' },
    ])
  })

  it('should update associates field with correct names', async () => {
    const associates: [string, string[]][] = [
      ['1', ['2']],
      ['2', ['3', '1']],
    ]

    const repo = new MongoSanctionsRepository()
    await repo.saveAssociations('dowjones', associates, '')

    const result = await collection.find({}).toArray()

    expect(result).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: '1', name: 'Tim', associates: ['Bob'] }),
        expect.objectContaining({
          id: '2',
          name: 'Bob',
          associates: expect.arrayContaining(['Sam', 'Tim']),
        }),
        expect.objectContaining({
          id: '3',
          name: 'Sam',
        }),
      ])
    )
  })

  it('should handle empty associate arrays', async () => {
    const associates: [string, string[]][] = [
      ['1', []],
      ['2', []],
    ]

    const repo = new MongoSanctionsRepository()
    await repo.saveAssociations('dowjones', associates, '')

    const result = await collection.find({}).toArray()

    expect(result).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: '1', name: 'Tim', associates: [] }),
        expect.objectContaining({ id: '2', name: 'Bob', associates: [] }),
        expect.objectContaining({ id: '3', name: 'Sam' }),
      ])
    )
  })

  it('should not modify documents without associates', async () => {
    const associates: [string, string[]][] = [['1', ['2']]]

    const repo = new MongoSanctionsRepository()
    await repo.saveAssociations('dowjones', associates, '')

    const result = await collection.findOne({ id: '3' })

    expect(result).toEqual(
      expect.objectContaining({
        id: '3',
        name: 'Sam',
      })
    )
  })

  it('should not fail if there are no associates to update', async () => {
    const associates: [string, string[]][] = []

    const repo = new MongoSanctionsRepository()
    await repo.saveAssociations('dowjones', associates, '')

    const result = await collection.find({}).toArray()

    expect(result).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: '1', name: 'Tim' }),
        expect.objectContaining({ id: '2', name: 'Bob' }),
        expect.objectContaining({ id: '3', name: 'Sam' }),
      ])
    )
  })
})
