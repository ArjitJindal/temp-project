import { v4 as uuidv4 } from 'uuid'
import { TarponStackConstants } from '../../../../lib/constants'
import { RuleInstance } from '../../../@types/openapi-internal/ruleInstance'
import { DynamoDbKeys } from '../../../core/dynamodb/dynamodb-keys'

export class RuleRepository {
  dynamoDb: AWS.DynamoDB.DocumentClient
  tenantId: string

  constructor(tenantId: string, dynamoDb: AWS.DynamoDB.DocumentClient) {
    this.dynamoDb = dynamoDb
    this.tenantId = tenantId
  }

  async createOrUpdateRuleInstance(
    ruleInstance: RuleInstance
  ): Promise<RuleInstance> {
    const ruleInstanceId = ruleInstance.id || uuidv4()
    const now = Date.now()
    const newRuleInstance = {
      ...ruleInstance,
      id: ruleInstanceId,
      createdAt: ruleInstance.createdAt || now,
      updatedAt: ruleInstance.updatedAt || now,
      runCount: ruleInstance.runCount || 0,
      hitCount: ruleInstance.hitCount || 0,
    }
    const putItemInput: AWS.DynamoDB.DocumentClient.PutItemInput = {
      TableName: TarponStackConstants.DYNAMODB_TABLE_NAME,
      Item: {
        ...DynamoDbKeys.RULE_INSTANCE(this.tenantId, ruleInstanceId),
        ...newRuleInstance,
      },
      ReturnConsumedCapacity: 'TOTAL',
    }
    await this.dynamoDb.put(putItemInput).promise()
    return newRuleInstance
  }

  async deleteRuleInstance(ruleInstanceId: string): Promise<void> {
    const deleteItemInput: AWS.DynamoDB.DocumentClient.DeleteItemInput = {
      TableName: TarponStackConstants.DYNAMODB_TABLE_NAME,
      Key: DynamoDbKeys.RULE_INSTANCE(this.tenantId, ruleInstanceId),
      ReturnConsumedCapacity: 'TOTAL',
    }
    await this.dynamoDb.delete(deleteItemInput).promise()
  }

  async getActiveRuleInstances(): Promise<ReadonlyArray<RuleInstance>> {
    const status = RuleInstance.StatusEnum.Active
    const queryInput: AWS.DynamoDB.DocumentClient.QueryInput = {
      TableName: TarponStackConstants.DYNAMODB_TABLE_NAME,
      KeyConditionExpression: 'PartitionKeyID = :pk',
      FilterExpression: '#status = :status',
      ExpressionAttributeValues: {
        ':pk': DynamoDbKeys.RULE_INSTANCE(this.tenantId).PartitionKeyID,
        ':status': status,
      },
      ExpressionAttributeNames: {
        '#status': 'status',
      },
      ReturnConsumedCapacity: 'TOTAL',
    }

    const result = await this.dynamoDb.query(queryInput).promise()
    return (
      result.Items?.map((item) => ({
        id: item.id,
        ruleId: item.ruleId,
        parameters: item.parameters,
        status: item.status,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
        runCount: item.runCount,
        hitCount: item.hitCount,
      })) || []
    )
  }
}
