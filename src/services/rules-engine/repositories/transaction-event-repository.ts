import { v4 as uuidv4 } from 'uuid'
import { MongoClient } from 'mongodb'
import _ from 'lodash'
import { TarponStackConstants } from '@cdk/constants'
import { WriteRequest } from 'aws-sdk/clients/dynamodb'
import { DynamoDbKeys } from '@/core/dynamodb/dynamodb-keys'
import { ExecutedRulesResult } from '@/@types/openapi-public/ExecutedRulesResult'
import { TransactionEvent } from '@/@types/openapi-public/TransactionEvent'
import { HitRulesResult } from '@/@types/openapi-public/HitRulesResult'

export class TransactionEventRepository {
  dynamoDb: AWS.DynamoDB.DocumentClient
  mongoDb: MongoClient
  tenantId: string

  constructor(
    tenantId: string,
    connections: {
      dynamoDb?: AWS.DynamoDB.DocumentClient
      mongoDb?: MongoClient
    }
  ) {
    this.dynamoDb = connections.dynamoDb as AWS.DynamoDB.DocumentClient
    this.mongoDb = connections.mongoDb as MongoClient
    this.tenantId = tenantId
  }

  public async saveTransactionEvent(
    transactionEvent: TransactionEvent,
    rulesResult: {
      executedRules?: ExecutedRulesResult[]
      hitRules?: HitRulesResult[]
    } = {}
  ): Promise<string> {
    const eventId = transactionEvent.eventId || uuidv4()

    const batchWriteItemParams: AWS.DynamoDB.DocumentClient.BatchWriteItemInput =
      {
        RequestItems: {
          [TarponStackConstants.DYNAMODB_TABLE_NAME]: [
            {
              PutRequest: {
                Item: {
                  ...DynamoDbKeys.TRANSACTION_EVENT(
                    this.tenantId,
                    transactionEvent.transactionId,
                    transactionEvent.timestamp
                  ),
                  eventId,
                  ...transactionEvent,
                  ...rulesResult,
                },
              },
            },
          ].filter(Boolean) as WriteRequest[],
        },
        ReturnConsumedCapacity: 'TOTAL',
      }
    await this.dynamoDb.batchWrite(batchWriteItemParams).promise()
    return eventId
  }
}
