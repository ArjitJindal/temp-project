import { MongoDbConsumer } from '..'
import { getTestTenantId } from '@/test-utils/tenant-test-utils'
import { getMongoDbClient } from '@/utils/mongodb-utils'

const getService = async () => {
  const mongoDbClient = await getMongoDbClient()
  return new MongoDbConsumer(mongoDbClient)
}

describe('Fetch Table Details', () => {
  it('should return correct table details', async () => {
    const tenantId = getTestTenantId()
    const mongoDbConsumerService = await getService()
    expect(
      mongoDbConsumerService.fetchTableDetails(`${tenantId}-cases`)
    ).toMatchObject({
      tenantId,
      collectionName: `${tenantId}-cases`,
      clickhouseTable: {
        table: 'cases',
      },
    })
  })

  it('should return null if the table is not found', async () => {
    const tenantId = getTestTenantId()
    const mongoDbConsumerService = await getService()
    expect(
      mongoDbConsumerService.fetchTableDetails(`${tenantId}-cases-1`)
    ).toBeFalsy()
  })
})

describe('Handle Messages', () => {
  it('should return correct messages to delete and replace', async () => {
    const mongoDbConsumerService = await getService()
    expect(
      mongoDbConsumerService.segregateMessages([
        {
          documentKey: {
            _id: '666666666666666666666666',
          },
          operationType: 'delete',
          clusterTime: 0,
          collectionName: 'cases',
        },
        {
          documentKey: {
            _id: '666666666666666666666666',
          },
          operationType: 'update',
          clusterTime: 1,
          collectionName: 'cases',
        },
      ])
    ).toMatchObject({
      messagesToReplace: {
        cases: [
          {
            documentKey: {
              _id: '666666666666666666666666',
            },
            operationType: 'update',
            clusterTime: 1,
            collectionName: 'cases',
          },
        ],
      },
      messagesToDelete: {},
    })
  })

  it('should return correct messages to delete and replace', async () => {
    const mongoDbConsumerService = await getService()
    expect(
      mongoDbConsumerService.segregateMessages([
        {
          documentKey: {
            _id: '666666666666666666666666',
          },
          operationType: 'delete',
          clusterTime: 0,
          collectionName: 'cases',
        },
      ])
    ).toMatchObject({
      messagesToDelete: {
        cases: [
          {
            documentKey: {
              _id: '666666666666666666666666',
            },
            operationType: 'delete',
            clusterTime: 0,
            collectionName: 'cases',
          },
        ],
      },
      messagesToReplace: {},
    })
  })
})
