import { StackConstants } from '@lib/constants'
import { range } from 'lodash'
import {
  batchGet,
  batchWrite,
  getDynamoDbClient,
  paginateQuery,
  transactWrite,
} from '../dynamodb'
import { dynamoDbSetupHook } from '@/test-utils/dynamodb-test-utils'
const MOCK_RECORDS_COUNT = 250
const MOCK_ATTRIBUTES = {
  attribute1: new Array(1000).fill(0),
  attribute2: new Array(1000).fill(0),
  attribute3: new Array(1000).fill(0),
}
const MOCK_ITEMS = range(0, MOCK_RECORDS_COUNT)
  .map((i) => ({
    ...MOCK_ATTRIBUTES,
    PartitionKeyID: 'partition',
    SortKeyID: `${i}`,
  }))
  .sort((a, b) => a.SortKeyID.localeCompare(b.SortKeyID))

const dynamoDb = getDynamoDbClient()

dynamoDbSetupHook()

const tenantId = 'tenantId'
describe('paginateQuery', () => {
  beforeAll(async () => {
    // We need enough data to make query response paginated. Currently it'll result in 2 pages
    await batchWrite(
      dynamoDb,
      MOCK_ITEMS.map((item) => ({
        PutRequest: { Item: item },
      })),
      StackConstants.TARPON_DYNAMODB_TABLE_NAME(tenantId)
    )
  })
  test('Returns all items - paginated', async () => {
    const result = await paginateQuery(dynamoDb, {
      TableName: StackConstants.TARPON_DYNAMODB_TABLE_NAME(tenantId),
      KeyConditionExpression: 'PartitionKeyID = :pk',
      ExpressionAttributeValues: {
        ':pk': 'partition',
      },
    })
    expect(result).toMatchObject({
      Count: MOCK_RECORDS_COUNT,
      ScannedCount: MOCK_RECORDS_COUNT,
      Items: MOCK_ITEMS,
    })
  })

  test('Returns all items - not paginated', async () => {
    const result = await paginateQuery(dynamoDb, {
      TableName: StackConstants.TARPON_DYNAMODB_TABLE_NAME(tenantId),
      KeyConditionExpression: 'PartitionKeyID = :pk AND SortKeyID = :sk',
      ExpressionAttributeValues: {
        ':pk': 'partition',
        ':sk': '100',
      },
    })
    expect(result).toMatchObject({
      Count: 1,
      ScannedCount: 1,
      Items: [
        {
          ...MOCK_ATTRIBUTES,
          PartitionKeyID: 'partition',
          SortKeyID: `100`,
        },
      ],
    })
  })

  test('Returns all items - with Limit', async () => {
    const result = await paginateQuery(dynamoDb, {
      TableName: StackConstants.TARPON_DYNAMODB_TABLE_NAME(tenantId),
      KeyConditionExpression: 'PartitionKeyID = :pk',
      ExpressionAttributeValues: {
        ':pk': 'partition',
      },
      Limit: 249,
    })
    expect(result).toMatchObject({
      Count: 249,
      ScannedCount: 249,
      Items: MOCK_ITEMS.slice(0, 249),
    })
  })

  test('Pagination - skip across multiple pages', async () => {
    const result = await paginateQuery(
      dynamoDb,
      {
        TableName: StackConstants.TARPON_DYNAMODB_TABLE_NAME(tenantId),
        KeyConditionExpression: 'PartitionKeyID = :pk',
        ExpressionAttributeValues: {
          ':pk': 'partition',
        },
      },
      { skip: 249 }
    )
    expect(result).toMatchObject({
      Count: 1,
      ScannedCount: 1,
      Items: [
        {
          ...MOCK_ATTRIBUTES,
          PartitionKeyID: 'partition',
          SortKeyID: `99`,
        },
      ],
    })
  })

  test('Pagination - skip in the first page', async () => {
    const result = await paginateQuery(
      dynamoDb,
      {
        TableName: StackConstants.TARPON_DYNAMODB_TABLE_NAME(tenantId),
        KeyConditionExpression: 'PartitionKeyID = :pk',
        ExpressionAttributeValues: {
          ':pk': 'partition',
        },
      },
      { skip: 1, limit: 1 }
    )
    expect(result).toMatchObject({
      Count: 1,
      ScannedCount: 1,
      Items: [
        {
          ...MOCK_ATTRIBUTES,
          PartitionKeyID: 'partition',
          SortKeyID: `1`,
        },
      ],
    })
  })

  test('Pagination - limit accross multiple pages', async () => {
    const result = await paginateQuery(
      dynamoDb,
      {
        TableName: StackConstants.TARPON_DYNAMODB_TABLE_NAME(tenantId),
        KeyConditionExpression: 'PartitionKeyID = :pk',
        ExpressionAttributeValues: {
          ':pk': 'partition',
        },
      },
      { limit: 249 }
    )
    expect(result).toMatchObject({
      Count: 249,
      ScannedCount: 249,
      Items: MOCK_ITEMS.slice(0, 249),
    })
  })

  test('Pagination - skip + limit', async () => {
    const result = await paginateQuery(
      dynamoDb,
      {
        TableName: StackConstants.TARPON_DYNAMODB_TABLE_NAME(tenantId),
        KeyConditionExpression: 'PartitionKeyID = :pk',
        ExpressionAttributeValues: {
          ':pk': 'partition',
        },
      },
      { skip: 239, limit: 3 }
    )
    expect(result).toMatchObject({
      Count: 3,
      ScannedCount: 3,
      Items: [
        {
          ...MOCK_ATTRIBUTES,
          PartitionKeyID: 'partition',
          SortKeyID: `9`,
        },
        {
          ...MOCK_ATTRIBUTES,
          PartitionKeyID: 'partition',
          SortKeyID: `90`,
        },
        {
          ...MOCK_ATTRIBUTES,
          PartitionKeyID: 'partition',
          SortKeyID: `91`,
        },
      ],
    })
  })

  test('batchGet', async () => {
    const result = await batchGet<any>(
      dynamoDb,
      StackConstants.TARPON_DYNAMODB_TABLE_NAME(tenantId),
      MOCK_ITEMS.map((v) => ({
        PartitionKeyID: v.PartitionKeyID,
        SortKeyID: v.SortKeyID,
      })),
      {}
    )
    expect(
      result.sort((a, b) => a.SortKeyID.localeCompare(b.SortKeyID))
    ).toEqual(MOCK_ITEMS)
  })
})

describe('batchWrite', () => {
  test('Throws an error when item size exceeds the maximum allowed size', async () => {
    const largeItem = {
      // Create a large item with size greater than 400KB
      PartitionKeyID: 'partition',
      SortKeyID: `1212`,
      attribute1: new Array(100000).fill(0),
      attribute2: new Array(100000).fill(0),
      attribute3: new Array(100000).fill(0),
    }

    const requests = [
      {
        PutRequest: {
          Item: largeItem,
        },
      },
    ]
    await expect(
      batchWrite(
        dynamoDb,
        requests,
        StackConstants.TARPON_DYNAMODB_TABLE_NAME(tenantId)
      )
    ).resolves.not.toThrow()
  })

  test('Throws an error for some other issue', async () => {
    const invalidItem = {
      // Create an invalid item with missing required attributes
      attribute1: 'value1',
      attribute2: 'value2',
    }

    const requests = [
      {
        PutRequest: {
          Item: invalidItem,
        },
      },
    ]
    await expect(
      batchWrite(
        dynamoDb,
        requests,
        StackConstants.TARPON_DYNAMODB_TABLE_NAME(tenantId)
      )
    ).rejects.toThrow()
  })
})

describe('transactWrite', () => {
  test('Successfully performs transactWrite operations', async () => {
    const operations = [
      {
        Put: {
          TableName: StackConstants.TARPON_DYNAMODB_TABLE_NAME(tenantId),
          Item: {
            PartitionKeyID: 'transact-partition',
            SortKeyID: '1',
            data: 'test data 1',
          },
        },
      },
      {
        Put: {
          TableName: StackConstants.TARPON_DYNAMODB_TABLE_NAME(tenantId),
          Item: {
            PartitionKeyID: 'transact-partition',
            SortKeyID: '2',
            data: 'test data 2',
          },
        },
      },
    ]

    await expect(transactWrite(dynamoDb, operations)).resolves.not.toThrow()

    // Verify items were written
    const result = await paginateQuery(dynamoDb, {
      TableName: StackConstants.TARPON_DYNAMODB_TABLE_NAME(tenantId),
      KeyConditionExpression: 'PartitionKeyID = :pk',
      ExpressionAttributeValues: {
        ':pk': 'transact-partition',
      },
    })

    expect(result.Items).toHaveLength(2)
    expect(result.Items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          PartitionKeyID: 'transact-partition',
          SortKeyID: '1',
          data: 'test data 1',
        }),
        expect.objectContaining({
          PartitionKeyID: 'transact-partition',
          SortKeyID: '2',
          data: 'test data 2',
        }),
      ])
    )
  })

  test('Handles large item size without throwing an error', async () => {
    const largeItem = {
      PartitionKeyID: 'transact-partition',
      SortKeyID: 'large',
      attribute1: new Array(100000).fill(0),
      attribute2: new Array(100000).fill(0),
      attribute3: new Array(100000).fill(0),
    }

    const operations = [
      {
        Put: {
          TableName: StackConstants.TARPON_DYNAMODB_TABLE_NAME(tenantId),
          Item: largeItem,
        },
      },
    ]

    await expect(transactWrite(dynamoDb, operations)).resolves.not.toThrow()
  })

  test('Throws an error for invalid operations', async () => {
    const invalidOperations = [
      {
        Put: {
          TableName: StackConstants.TARPON_DYNAMODB_TABLE_NAME(tenantId),
          Item: {
            // Missing required key attributes
            data: 'invalid data',
          },
        },
      },
    ]

    await expect(transactWrite(dynamoDb, invalidOperations)).rejects.toThrow()
  })
})
