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
import { isEqual } from 'lodash'
import { getAggVarHash } from '../v8-engine/aggregation-repository'
import { DynamoDbKeys } from '@/core/dynamodb/dynamodb-keys'
import { RuleInstance } from '@/@types/openapi-internal/RuleInstance'
import { paginateQuery } from '@/utils/dynamodb'
import { DEFAULT_RISK_LEVEL } from '@/services/risk-scoring/utils'
import { traceable } from '@/core/xray'
import { RuleAggregationVariable } from '@/@types/openapi-internal/RuleAggregationVariable'
import { RuleType } from '@/@types/openapi-internal/RuleType'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import { CounterRepository } from '@/services/counter/repository'
import { RuleMode } from '@/@types/openapi-internal/RuleMode'
import { RuleInstanceStatus } from '@/@types/openapi-internal/RuleInstanceStatus'

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
    logicEntityVariables: item.logicEntityVariables,
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
    createdBy: item.createdBy,
    mode: item.mode,
    userRuleRunCondition: item.userRuleRunCondition,
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

  public async getNewRuleInstanceId(
    ruleId: string,
    update = false
  ): Promise<string> {
    const mongoDb = await getMongoDbClient()

    const counterRepository = new CounterRepository(this.tenantId, mongoDb)

    const nextCount = await counterRepository[
      update ? 'getNextCounterAndUpdate' : 'getNextCounter'
    ](ruleId as any)

    if (ruleId.startsWith('RC')) {
      // When we create a new custom rule the rule instance id is `RC-<count>`
      // When we duplicate a custom rule the rule instance id is `RC-<N>.1`
      return nextCount === 1 ? ruleId : `${ruleId}.${nextCount - 1}`
    } else {
      return `${ruleId}.${nextCount}`
    }
  }

  public async getNewCustomRuleId(update = false): Promise<string> {
    const mongoDb = await getMongoDbClient()
    const counterRepository = new CounterRepository(this.tenantId, mongoDb)
    const count = await counterRepository[
      update ? 'getNextCounterAndUpdate' : 'getNextCounter'
    ]('RC')

    return `RC-${count}`
  }

  public async createOrUpdateRuleInstance(
    ruleInstance: RuleInstance,
    updatedAt?: number
  ): Promise<RuleInstance> {
    const ruleId = ruleInstance.ruleId ?? (await this.getNewCustomRuleId(true))

    const ruleInstanceId =
      ruleInstance.id || (await this.getNewRuleInstanceId(ruleId, true))

    const now = Date.now()
    const newRuleInstance: RuleInstance = {
      ...ruleInstance,
      // Save fallback parameters/action in case we remove PULSE feature flag
      logic:
        ruleInstance.logic ??
        Object.values(ruleInstance.riskLevelLogic ?? {})[0],
      logicAggregationVariables: await this.getLogicAggVarsWithUpdatedVersion(
        ruleInstance
      ),
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
      ruleId,
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

  private async getLogicAggVarsWithUpdatedVersion(
    ruleInstance: RuleInstance
  ): Promise<RuleAggregationVariable[] | undefined> {
    // Early return if no aggregation variables
    if (
      !ruleInstance.logicAggregationVariables ||
      ruleInstance.logicAggregationVariables.length === 0
    ) {
      return ruleInstance.logicAggregationVariables
    }

    const oldRuleInstance = ruleInstance.id
      ? await this.getRuleInstanceById(ruleInstance.id)
      : null

    // Early return if aggregation variables are not changed
    const isBeingEnabled =
      (!oldRuleInstance || oldRuleInstance?.status === 'INACTIVE') &&
      ruleInstance.status === 'ACTIVE'
    if (
      ruleInstance.status === 'INACTIVE' ||
      (!isBeingEnabled &&
        isEqual(
          oldRuleInstance?.logicAggregationVariables?.map((v) =>
            getAggVarHash(v, false)
          ),
          ruleInstance.logicAggregationVariables?.map((v) =>
            getAggVarHash(v, false)
          )
        ))
    ) {
      return ruleInstance.logicAggregationVariables
    }

    const activeRuleInstances = await this.getActiveRuleInstances(
      ruleInstance.type
    )
    const activeLogicAggregationVariables = activeRuleInstances.flatMap(
      (r) => r.logicAggregationVariables ?? []
    )
    const newVersion = Date.now()
    return ruleInstance.logicAggregationVariables.map((aggVar) => {
      const existingSameAggVar = activeLogicAggregationVariables.find(
        (v) => getAggVarHash(v, false) === getAggVarHash(aggVar, false)
      )
      // NOTE: An aggregation variable's version is determined by the timestamp when
      // it is first created and enabled. This is to ensure that the version is consistent.
      return {
        ...aggVar,
        version: existingSameAggVar?.version ?? newVersion,
      }
    })
  }

  public async deleteRuleInstance(ruleInstanceId: string): Promise<void> {
    const deleteItemInput: DeleteCommandInput = {
      TableName: StackConstants.TARPON_RULE_DYNAMODB_TABLE_NAME,
      Key: DynamoDbKeys.RULE_INSTANCE(this.tenantId, ruleInstanceId),
    }
    await this.dynamoDb.send(new DeleteCommand(deleteItemInput))
  }

  public async getActiveRuleInstances(
    type?: RuleType
  ): Promise<ReadonlyArray<RuleInstance>> {
    const status: RuleInstanceStatus = 'ACTIVE'
    const ruleInstances = await this.getRuleInstances({
      FilterExpression: '#status = :status',
      ExpressionAttributeValues: {
        ':status': status,
      },
      ExpressionAttributeNames: {
        '#status': 'status',
      },
    })
    return type ? ruleInstances.filter((r) => r.type === type) : ruleInstances
  }

  public async getAllRuleInstances(mode?: RuleMode): Promise<RuleInstance[]> {
    return this.getRuleInstances(
      mode
        ? {
            FilterExpression: '#mode = :mode',
            ExpressionAttributeValues: { ':mode': mode },
            ExpressionAttributeNames: { '#mode': 'mode' },
          }
        : {}
    )
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
  ): Promise<Array<RuleInstance>> {
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
