import { MongoDbConsumer } from '..'
import { getClickhouseClient } from '@/utils/clickhouse/utils'
import { getMongoDbClient } from '@/utils/mongodb-utils'

const getService = async () => {
  const clickhouseClient = await getClickhouseClient()
  const mongoDbClient = await getMongoDbClient()
  return new MongoDbConsumer(mongoDbClient, clickhouseClient)
}

describe('Fetch Table Details', () => {
  it('should return correct table details', async () => {
    const mongoDbConsumerService = await getService()
    expect(
      mongoDbConsumerService.fetchTableDetails('flagright-cases')
    ).toMatchObject({
      tenantId: 'flagright',
      collectionName: 'flagright-cases',
      clickhouseTable: {
        table: 'cases',
      },
    })
  })

  it('should return null if the table is not found', async () => {
    const mongoDbConsumerService = await getService()
    expect(
      mongoDbConsumerService.fetchTableDetails('flagright-cases123')
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
