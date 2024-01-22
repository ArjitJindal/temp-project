import { StackConstants } from '@lib/constants'
import {
  DeleteCommand,
  DeleteCommandInput,
  DynamoDBDocumentClient,
  GetCommand,
  GetCommandInput,
  PutCommand,
  PutCommandInput,
  QueryCommandInput,
  UpdateCommand,
  UpdateCommandInput,
} from '@aws-sdk/lib-dynamodb'
import { shortId } from '@flagright/lib/utils'
import { DynamoDbKeys } from '@/core/dynamodb/dynamodb-keys'
import {
  RuleInstance,
  RuleInstanceStatusEnum,
} from '@/@types/openapi-internal/RuleInstance'
import { RuleTypeEnum } from '@/@types/openapi-internal/Rule'
import { paginateQuery } from '@/utils/dynamodb'
import { DEFAULT_RISK_LEVEL } from '@/services/risk-scoring/utils'
import { traceable } from '@/core/xray'
function toRuleInstance(item: any): RuleInstance {
  return {
    id: item.id,
    type: item.type,
    ruleId: item.ruleId,
    ruleNameAlias: item.ruleNameAlias,
    ruleDescriptionAlias: item.ruleDescriptionAlias,
    filters: item.filters,
    baseCurrency: item.baseCurrency,
    logic: item.logic,
    riskLevelLogic: item.riskLevelLogic,
    logicAggregationVariables: item.logicAggregationVariables,
    parameters:
      item.parameters ?? item.riskLevelParameters?.[DEFAULT_RISK_LEVEL],
    riskLevelParameters: item.riskLevelParameters,
    action: item.action,
    riskLevelActions: item.riskLevelActions,
    status: item.status,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
    runCount: item.runCount,
    hitCount: item.hitCount,
    casePriority: item.casePriority,
    falsePositiveCheckEnabled: item.falsePositiveCheckEnabled,
    nature: item.nature,
    labels: item.labels,
    checklistTemplateId: item.checklistTemplateId,
    triggersOnHit: item.triggersOnHit,
    riskLevelsTriggersOnHit: item.riskLevelsTriggersOnHit,
    queueId: item.queueId,
    alertConfig: item.alertConfig,
    checksFor: item.checksFor,
  }
}

@traceable
export class RuleInstanceRepository {
  dynamoDb: DynamoDBDocumentClient

  tenantId: string

  constructor(
    tenantId: string,
    connections: {
      dynamoDb?: DynamoDBDocumentClient
    }
  ) {
    this.dynamoDb = connections.dynamoDb as DynamoDBDocumentClient
    this.tenantId = tenantId
  }

  public async getNewRuleInstanceId(): Promise<string> {
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const newRuleInstanceId = shortId()
      const existingRuleInstance = await this.getRuleInstanceById(
        newRuleInstanceId
      )
      if (!existingRuleInstance) {
        return newRuleInstanceId
      }
    }
  }

  public async createOrUpdateRuleInstance(
    ruleInstance: RuleInstance,
    updatedAt?: number
  ): Promise<RuleInstance> {
    const ruleInstanceId =
      ruleInstance.id || (await this.getNewRuleInstanceId())
    const now = Date.now()
    const newRuleInstance: RuleInstance = {
      ...ruleInstance,
      // Save fallback parameters/action in case we remove PULSE feature flag
      logic:
        ruleInstance.logic ??
        Object.values(ruleInstance.riskLevelLogic ?? {})[0],
      parameters:
        ruleInstance.parameters ??
        Object.values(ruleInstance.riskLevelParameters ?? {})[0],
      action:
        ruleInstance.action ??
        Object.values(ruleInstance.riskLevelActions ?? {})[0],
      id: ruleInstanceId,
      status: ruleInstance.status || 'ACTIVE',
      createdAt: ruleInstance.createdAt || now,
      updatedAt: updatedAt ?? now,
      runCount: ruleInstance.runCount || 0,
      hitCount: ruleInstance.hitCount || 0,
      alertConfig: ruleInstance.alertConfig,
    }
    const putItemInput: PutCommandInput = {
      TableName: StackConstants.TARPON_RULE_DYNAMODB_TABLE_NAME,
      Item: {
        ...DynamoDbKeys.RULE_INSTANCE(this.tenantId, ruleInstanceId),
        ...newRuleInstance,
      },
    }
    await this.dynamoDb.send(new PutCommand(putItemInput))
    return newRuleInstance
  }

  public async deleteRuleInstance(ruleInstanceId: string): Promise<void> {
    const deleteItemInput: DeleteCommandInput = {
      TableName: StackConstants.TARPON_RULE_DYNAMODB_TABLE_NAME,
      Key: DynamoDbKeys.RULE_INSTANCE(this.tenantId, ruleInstanceId),
    }
    await this.dynamoDb.send(new DeleteCommand(deleteItemInput))
  }

  public async getActiveRuleInstances(
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

  public async getAllRuleInstances(): Promise<RuleInstance[]> {
    return this.getRuleInstances({})
  }

  public async getRuleInstanceById(
    ruleInstanceId: string
  ): Promise<RuleInstance | null> {
    const getItemInput: GetCommandInput = {
      TableName: StackConstants.TARPON_RULE_DYNAMODB_TABLE_NAME,
      Key: DynamoDbKeys.RULE_INSTANCE(this.tenantId, ruleInstanceId),
    }
    const result = await this.dynamoDb.send(new GetCommand(getItemInput))
    return result.Item ? toRuleInstance(result.Item) : null
  }

  async getRuleInstancesByIds(
    ruleInstanceIds: string[]
  ): Promise<ReadonlyArray<RuleInstance>> {
    if (ruleInstanceIds.length === 0) {
      return []
    }
    const ruleInstancePromises = ruleInstanceIds.map((ruleInstanceId) =>
      this.getRuleInstanceById(ruleInstanceId)
    )
    const ruleInstances = await Promise.all(ruleInstancePromises)
    return ruleInstances.filter(
      (ruleInstance) => ruleInstance
    ) as RuleInstance[]
  }

  private async getRuleInstances(
    query: Partial<QueryCommandInput>
  ): Promise<RuleInstance[]> {
    const queryInput: QueryCommandInput = {
      ...query,
      TableName: StackConstants.TARPON_RULE_DYNAMODB_TABLE_NAME,
      KeyConditionExpression: 'PartitionKeyID = :pk',

      ExpressionAttributeValues: {
        ...query.ExpressionAttributeValues,
        ':pk': DynamoDbKeys.RULE_INSTANCE(this.tenantId).PartitionKeyID,
      },
    }
    const result = await paginateQuery(this.dynamoDb, queryInput)
    return result.Items?.map(toRuleInstance) || []
  }

  public async incrementRuleInstanceStatsCount(
    runRuleInstanceIds: string[],
    hitRuleInstanceIds: string[]
  ) {
    await this.updateRuleInstanceStatsCount(
      runRuleInstanceIds,
      hitRuleInstanceIds,
      {
        runCountStep: 1,
        hitCountStep: 1,
      }
    )
  }

  public async updateRuleInstanceStatsCount(
    runRuleInstanceIds: string[],
    hitRuleInstanceIds: string[],
    update: { runCountStep: number; hitCountStep: number }
  ) {
    const hitRuleInstanceIdsSet = new Set(hitRuleInstanceIds)
    await Promise.all(
      runRuleInstanceIds.map((runRuleInstanceId) => {
        const updateItemInput: UpdateCommandInput = {
          TableName: StackConstants.TARPON_RULE_DYNAMODB_TABLE_NAME,
          Key: DynamoDbKeys.RULE_INSTANCE(this.tenantId, runRuleInstanceId),
          UpdateExpression: `SET runCount = runCount + :runCountInc, hitCount = hitCount + :hitCountInc`,
          ExpressionAttributeValues: {
            ':runCountInc': update.runCountStep,
            ':hitCountInc': hitRuleInstanceIdsSet.has(runRuleInstanceId)
              ? update.hitCountStep
              : 0,
          },
          ReturnValues: 'UPDATED_NEW',
        }
        return this.dynamoDb.send(new UpdateCommand(updateItemInput))
      })
    )
  }
  public async deleteRuleQueue(ruleQueueId: string) {
    const ruleInstances = await this.getAllRuleInstances()
    const targetRuleInstances = ruleInstances.filter(
      (ruleInstance) => ruleInstance.queueId === ruleQueueId
    )
    for (const ruleInstance of targetRuleInstances) {
      await this.createOrUpdateRuleInstance({
        ...ruleInstance,
        queueId: undefined,
      })
    }
  }
}
