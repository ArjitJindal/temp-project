import {
  DynamoDBDocumentClient,
  GetCommand,
  GetCommandInput,
  UpdateCommand,
  UpdateCommandInput,
} from '@aws-sdk/lib-dynamodb'
import { StackConstants } from '@lib/constants'
import { groupBy } from 'lodash'
import {
  AsyncBatchRecord,
  AsyncRuleRecordUserBatch,
  AsyncRuleRecordUserEventBatch,
} from '../rules-engine/utils'
import { BatchEntity, EntityList, getDynamoKeys, getEntityId } from './utils'
import { UserType } from '@/@types/openapi-internal/UserType'

export class BatchRepository {
  private dynamoDb: DynamoDBDocumentClient
  private readonly dynamoTable: string
  private tenantId: string
  constructor(tenantId: string, dynamoDb: DynamoDBDocumentClient) {
    this.tenantId = tenantId
    this.dynamoDb = dynamoDb
    this.dynamoTable = StackConstants.TARPON_DYNAMODB_TABLE_NAME(tenantId)
  }

  private getUpdateRequests(entities: AsyncBatchRecord[]) {
    const groupedData = groupBy(
      entities,
      (entity) => `${entity.batchId}-${entity.type}`
    )
    const requests = Object.values(groupedData).map(
      (entities): UpdateCommandInput => {
        const ids = entities.map((entity) => getEntityId(entity))
        const referenceEntity = entities[0]
        const keys = getDynamoKeys(
          this.tenantId,
          referenceEntity.batchId,
          referenceEntity.type,
          ['USER_BATCH', 'USER_EVENT_BATCH'].includes(referenceEntity.type)
            ? (
                referenceEntity as
                  | AsyncRuleRecordUserBatch
                  | AsyncRuleRecordUserEventBatch
              ).userType
            : undefined
        )
        return {
          TableName: this.dynamoTable,
          Key: keys,
          UpdateExpression:
            'SET entityIds = list_append(if_not_exists(entityIds, :emptyList), :newIds)',
          ExpressionAttributeValues: {
            ':newIds': ids,
            ':emptyList': [],
          },
        }
      }
    )
    return requests
  }

  async saveBatchEntities(entities: AsyncBatchRecord[]) {
    const updateRequests = this.getUpdateRequests(entities)
    await Promise.all(
      updateRequests.map((request) =>
        this.dynamoDb.send(new UpdateCommand(request))
      )
    )
  }

  async getBatchEntityIds(
    batchId: string,
    entityType: BatchEntity,
    userType?: UserType
  ): Promise<string[] | undefined> {
    const keys = getDynamoKeys(this.tenantId, batchId, entityType, userType)
    const readRequest: GetCommandInput = {
      TableName: this.dynamoTable,
      Key: keys,
    }
    const result = await this.dynamoDb.send(new GetCommand(readRequest))
    if (!result.Item) {
      return undefined
    }
    return (result.Item as EntityList).entityIds
  }
}
