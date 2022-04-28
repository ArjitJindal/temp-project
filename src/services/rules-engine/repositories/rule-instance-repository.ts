import { MongoClient } from 'mongodb'
import { v4 as uuidv4 } from 'uuid'
import { TarponStackConstants } from '@cdk/constants'
import { DynamoDbKeys } from '@/core/dynamodb/dynamodb-keys'
import {
  RuleInstance,
  RuleInstanceStatusEnum,
} from '@/@types/openapi-internal/RuleInstance'
import { RuleTypeEnum } from '@/@types/openapi-internal/Rule'
import { paginateQuery } from '@/utils/dynamodb'

export class RuleInstanceRepository {
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

  async createOrUpdateRuleInstance(
    ruleInstance: RuleInstance
  ): Promise<RuleInstance> {
    const ruleInstanceId = ruleInstance.id || uuidv4()
    const now = Date.now()
    const newRuleInstance = {
      ...ruleInstance,
      id: ruleInstanceId,
      status: ruleInstance.status || 'ACTIVE',
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

  async getActiveRuleInstances(
    type: RuleTypeEnum
  ): Promise<ReadonlyArray<RuleInstance>> {
    const status: RuleInstanceStatusEnum = 'ACTIVE'
    return this.getRuleInstances({
      FilterExpression: '#status = :status AND #type = :type ',
      ExpressionAttributeValues: {
        ':status': status,
        ':type': type,
      },
      ExpressionAttributeNames: {
        '#status': 'status',
        '#type': 'type',
      },
    })
  }

  async getAllRuleInstances(): Promise<ReadonlyArray<RuleInstance>> {
    return this.getRuleInstances({})
  }

  private async getRuleInstances(
    query: Partial<AWS.DynamoDB.DocumentClient.QueryInput>
  ): Promise<ReadonlyArray<RuleInstance>> {
    const queryInput: AWS.DynamoDB.DocumentClient.QueryInput = {
      ...query,
      TableName: TarponStackConstants.DYNAMODB_TABLE_NAME,
      KeyConditionExpression: 'PartitionKeyID = :pk',
      ReturnConsumedCapacity: 'TOTAL',
      ExpressionAttributeValues: {
        ...query.ExpressionAttributeValues,
        ':pk': DynamoDbKeys.RULE_INSTANCE(this.tenantId).PartitionKeyID,
      },
    }
    const result = await paginateQuery(this.dynamoDb, queryInput)
    return (
      result.Items?.map((item) => ({
        id: item.id,
        type: item.type,
        ruleId: item.ruleId,
        parameters: item.parameters,
        action: item.action,
        status: item.status,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
        runCount: item.runCount,
        hitCount: item.hitCount,
      })) || []
    )
  }
}
