import { getMongoDbClient } from '@/utils/mongodb-utils'
import { SANCTIONS_COLLECTION } from '@/utils/mongo-table-names'
import { MongoSanctionsRepository } from '@/services/sanctions/repositories/sanctions-repository'
import { Action } from '@/services/sanctions/providers/types' // Adjust the path
import { SanctionsEntity } from '@/@types/openapi-internal/SanctionsEntity'

describe('MongoSanctionsRepository', () => {
  let collection: any

  beforeAll(async () => {
    // Connect to an in-memory or test MongoDB instance
    const mongoDb = await getMongoDbClient()
    collection = mongoDb.db().collection(SANCTIONS_COLLECTION('test'))
    // create collection if it doesn't exist
    const listCollections = await mongoDb.db().listCollections().toArray()
    if (
      !listCollections.find(
        (collection) => collection.name === SANCTIONS_COLLECTION('test')
      )
    ) {
      await mongoDb.db().createCollection(SANCTIONS_COLLECTION('test'))
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

    const repo = new MongoSanctionsRepository(SANCTIONS_COLLECTION('test'))
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

    const repo = new MongoSanctionsRepository(SANCTIONS_COLLECTION('test'))
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

    const repo = new MongoSanctionsRepository(SANCTIONS_COLLECTION('test'))
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

    const repo = new MongoSanctionsRepository(SANCTIONS_COLLECTION('test'))
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

  it('should update the record when action is "chg"', async () => {
    const repo = new MongoSanctionsRepository(SANCTIONS_COLLECTION('test'))

    // Insert initial entity
    const initialEntity = {
      provider: 'dowjones',
      id: '5',
      version: '24-08',
      name: 'Tim',
      gender: 'test',
    }
    await collection.insertOne(initialEntity)

    // Define "change" action data
    const entities = [
      [
        'chg',
        {
          id: '5',
          name: 'Tim Changed',
          gender: 'Changed',
        },
      ],
    ] as [Action, SanctionsEntity][]

    await repo.save('dowjones', entities, '24-08')

    // Verify that the record was updated
    const updatedEntity = await collection.findOne({ id: '5' })
    expect(updatedEntity).toEqual(
      expect.objectContaining({
        id: '5',
        provider: 'dowjones',
        version: '24-08',
        name: 'Tim Changed',
        gender: 'Changed',
        updatedAt: expect.any(Number),
      })
    )
  })
})
