import { TarponStackConstants } from '@cdk/constants'
import { chunk } from 'lodash'
import { DynamoDbKeys } from '@/core/dynamodb/dynamodb-keys'

export class ListRepository {
  dynamoDb: AWS.DynamoDB.DocumentClient
  tenantId: string

  constructor(tenantId: string, dynamoDb: AWS.DynamoDB.DocumentClient) {
    this.dynamoDb = dynamoDb
    this.tenantId = tenantId
  }

  async importList(
    listName: string,
    indexName: string,
    rows: Array<{ [key: string]: string }>
  ): Promise<void> {
    for (const rowsChunk of chunk(rows, 25)) {
      const putRequests = rowsChunk.map((row) => {
        if (!row[indexName]) {
          throw new Error(`row: ${row} has missing '${indexName}' field!`)
        }
        return {
          PutRequest: {
            Item: {
              ...DynamoDbKeys.LIST(this.tenantId, listName, row[indexName]),
              ...row,
            },
          },
        }
      })
      const batchWriteItemParams: AWS.DynamoDB.DocumentClient.BatchWriteItemInput =
        {
          RequestItems: {
            [TarponStackConstants.DYNAMODB_TABLE_NAME]: putRequests,
          },
          ReturnConsumedCapacity: 'TOTAL',
        }
      await this.dynamoDb.batchWrite(batchWriteItemParams).promise()
    }
  }
}
