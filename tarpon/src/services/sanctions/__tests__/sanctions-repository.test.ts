import { getMongoDbClient } from '@/utils/mongodb-utils'
import { SANCTIONS_COLLECTION } from '@/utils/mongodb-definitions'
import { MongoSanctionsRepository } from '@/services/sanctions/repositories/sanctions-repository' // Adjust the path

describe('MongoSanctionsRepository', () => {
  let collection: any

  beforeAll(async () => {
    // Connect to an in-memory or test MongoDB instance
    const mongoDb = await getMongoDbClient()
    collection = mongoDb.db().collection(SANCTIONS_COLLECTION)
    // create collection if it doesn't exist
    const listCollections = await mongoDb.db().listCollections().toArray()
    if (
      !listCollections.find(
        (collection) => collection.name === SANCTIONS_COLLECTION
      )
    ) {
      await mongoDb.db().createCollection(SANCTIONS_COLLECTION)
    }

    // create index if it doesn't exist
    const indexExists = await collection.indexExists(
      'provider_1_id_1_version_1'
    )

    if (!indexExists) {
      await collection.createIndex(
        { provider: 1, id: 1, version: 1 }, // Define the fields for the index
        { unique: true } // Enforce uniqueness
      )
    }
    // Seed the database with test data
    await collection.insertMany([
      { provider: 'dowjones', version: '24-08', id: '1', name: 'Tim' },
      { provider: 'dowjones', version: '24-08', id: '2', name: 'Bob' },
      { provider: 'dowjones', version: '24-08', id: '3', name: 'Sam' },
    ])
  })

  afterAll(async () => {
    await collection.drop()
  })

  it('should update associates field with correct names', async () => {
    const associates: [string, { id: string; association: string }[]][] = [
      ['1', [{ id: '2', association: '2' }]],
      [
        '2',
        [
          { id: '3', association: '3' },
          { id: '1', association: '1' },
        ],
      ],
    ]

    const repo = new MongoSanctionsRepository(SANCTIONS_COLLECTION)
    await repo.saveAssociations('dowjones', associates, '24-08')

    const result = await collection.find({}).toArray()
    expect(result).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: '1',
          name: 'Tim',
          associates: expect.arrayContaining([
            expect.objectContaining({ name: 'Bob' }),
          ]),
        }),
        expect.objectContaining({
          id: '2',
          name: 'Bob',
          associates: expect.arrayContaining([
            expect.objectContaining({ name: 'Tim' }),
            expect.objectContaining({ name: 'Sam' }),
          ]),
        }),
        expect.objectContaining({
          id: '3',
          name: 'Sam',
        }),
      ])
    )
  })

  it('should handle empty associate arrays', async () => {
    const associates: [string, { id: string; association: string }[]][] = [
      ['1', []],
      ['2', []],
    ]

    const repo = new MongoSanctionsRepository(SANCTIONS_COLLECTION)
    await repo.saveAssociations('dowjones', associates, '24-08')

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
    const associates: [string, { id: string; association: string }[]][] = [
      ['1', [{ id: '2', association: '2' }]],
    ]

    const repo = new MongoSanctionsRepository(SANCTIONS_COLLECTION)
    await repo.saveAssociations('dowjones', associates, '24-08')

    const result = await collection.findOne({ id: '3' })

    expect(result).toEqual(
      expect.objectContaining({
        id: '3',
        name: 'Sam',
      })
    )
  })

  it('should not fail if there are no associates to update', async () => {
    const associates: [string, { id: string; association: string }[]][] = []

    const repo = new MongoSanctionsRepository(SANCTIONS_COLLECTION)
    await repo.saveAssociations('dowjones', associates, '24-08')

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
