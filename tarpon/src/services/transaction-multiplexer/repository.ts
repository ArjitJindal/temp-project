import {
  DynamoDBDocumentClient,
  UpdateCommand,
  UpdateCommandInput,
  DeleteCommandInput,
  DeleteCommand,
} from '@aws-sdk/lib-dynamodb'
import { StackConstants } from '@lib/constants'
import pMap from 'p-map'
import { batchGet } from '@/utils/dynamodb'
import { DynamoDbKeys } from '@/core/dynamodb/dynamodb-keys'
import { IdentifierProcessingDetail } from '@/@types/rule/async-rule-multiplexer'

const WRITE_CONCURRENCY = 20

export class TransactionMultiplexerRepository {
  private tenantId: string
  private dynamoDb: DynamoDBDocumentClient
  constructor(tenantId: string, dynamoDb: DynamoDBDocumentClient) {
    this.tenantId = tenantId
    this.dynamoDb = dynamoDb
  }
  public async getIdentifiersProcessingDetails(
    identifiers: string[]
  ): Promise<IdentifierProcessingDetail[]> {
    const result = await batchGet<IdentifierProcessingDetail>(
      this.dynamoDb,
      StackConstants.TRANSIENT_DYNAMODB_TABLE_NAME,
      identifiers.map((identifier) =>
        DynamoDbKeys.ASYNC_RULE_PROCESSING_DETAILS(this.tenantId, identifier)
      )
    )
    return result
  }

  public async markIdentifiersAsProcessing(
    identifiers: string[],
    groupId: string,
    getIdentifierRecordsId: (identifier: string) => string[]
  ) {
    await pMap(
      identifiers,
      async (identifier) => {
        const identifierRecordsId = getIdentifierRecordsId(identifier)
        const command: UpdateCommandInput = {
          TableName: StackConstants.TRANSIENT_DYNAMODB_TABLE_NAME,
          Key: DynamoDbKeys.ASYNC_RULE_PROCESSING_DETAILS(
            this.tenantId,
            identifier
          ),
          UpdateExpression:
            'SET #groupId=:groupId, #updatedAt=:updatedAt ADD #recordSet :recordId',
          ExpressionAttributeNames: {
            '#groupId': 'groupId',
            '#updatedAt': 'updatedAt',
            '#recordSet': 'queuedRecordIdentifiers',
          },
          ExpressionAttributeValues: {
            ':groupId': groupId,
            ':updatedAt': Date.now(),
            ':recordId': new Set<string>(identifierRecordsId),
          },
        }
        await this.dynamoDb.send(new UpdateCommand(command))
      },
      { concurrency: WRITE_CONCURRENCY }
    )
  }

  public async markIdentifierAsProcessed(
    identifiers: string[],
    recordIdentifier: string
  ) {
    await pMap(
      identifiers,
      async (identifier) => {
        // Remove the recordIdentifier from the set
        const updateCommand: UpdateCommandInput = {
          TableName: StackConstants.TRANSIENT_DYNAMODB_TABLE_NAME,
          Key: DynamoDbKeys.ASYNC_RULE_PROCESSING_DETAILS(
            this.tenantId,
            identifier
          ),
          UpdateExpression:
            'DELETE #recordSet :recordId SET #updatedAt=:updatedAt',
          ExpressionAttributeNames: {
            '#recordSet': 'queuedRecordIdentifiers',
            '#updatedAt': 'updatedAt',
          },
          ExpressionAttributeValues: {
            ':recordId': new Set<string>([recordIdentifier]),
            ':updatedAt': Date.now(),
          },
        }

        // Delete the item only if the set is empty
        const deleteCommand: DeleteCommandInput = {
          TableName: StackConstants.TRANSIENT_DYNAMODB_TABLE_NAME,
          Key: DynamoDbKeys.ASYNC_RULE_PROCESSING_DETAILS(
            this.tenantId,
            identifier
          ),
          ConditionExpression:
            'attribute_not_exists(queuedRecordIdentifiers) OR size(queuedRecordIdentifiers) = :zero',
          ExpressionAttributeValues: {
            ':zero': 0,
          },
        }

        await this.dynamoDb.send(new UpdateCommand(updateCommand))
        await this.dynamoDb.send(new DeleteCommand(deleteCommand))
      },
      { concurrency: WRITE_CONCURRENCY }
    )
  }
}
