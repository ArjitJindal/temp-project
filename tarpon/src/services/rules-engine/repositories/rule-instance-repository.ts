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
import { isEqual, uniq, isEmpty, uniqBy } from 'lodash'
import dayjsLib from '@flagright/lib/utils/dayjs'
import { getAggVarHash } from '../v8-engine/aggregation-repository'
import { getMigratedV8Config, RuleMigrationConfig } from '../v8-migrations'
import { isV2RuleInstance } from '../utils'
import { DynamoDbKeys } from '@/core/dynamodb/dynamodb-keys'
import { RuleInstance } from '@/@types/openapi-internal/RuleInstance'
import { paginateQuery } from '@/utils/dynamodb'
import { DEFAULT_RISK_LEVEL } from '@/services/risk-scoring/utils'
import { traceable } from '@/core/xray'
import { RuleAggregationVariable } from '@/@types/openapi-internal/RuleAggregationVariable'
import { RuleType } from '@/@types/openapi-internal/RuleType'
import {
  DAY_DATE_FORMAT,
  getMongoDbClient,
  getMongoDbClientDb,
} from '@/utils/mongodb-utils'
import { CounterRepository } from '@/services/counter/repository'
import { RuleMode } from '@/@types/openapi-internal/RuleMode'
import { RuleInstanceStatus } from '@/@types/openapi-internal/RuleInstanceStatus'
import { AUDITLOG_COLLECTION } from '@/utils/mongodb-definitions'
import { hasFeature } from '@/core/utils/context'
import { RiskLevelRuleLogic } from '@/@types/openapi-internal/RiskLevelRuleLogic'
import {
  createPublicApiInMemoryCache,
  getInMemoryCacheKey,
} from '@/utils/memory-cache'
import { envIs, envIsNot } from '@/utils/env'

// NOTE: We only cache active rule instances for 10 minutes in production -> After a rule instance
// is activated, it'll be effective after 10 minutes (worst case).
const activeRuleInstancesCache = envIs('prod')
  ? createPublicApiInMemoryCache<readonly RuleInstance[]>({
      max: 10,
      ttlMinutes: 10,
    })
  : null

const ACTIVE_STATUS: RuleInstanceStatus = 'ACTIVE'
const DEPLOYING_STATUS: RuleInstanceStatus = 'DEPLOYING'

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
    logicMachineLearningVariables: item.logicMachineLearningVariables,
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

  public getV8PropsForV2RuleInstance(ruleInstance: RuleInstance) {
    const ruleId = ruleInstance.ruleId
    let migratedData: RuleMigrationConfig | null = null
    let v2RiskLevelLogic: RuleInstance['riskLevelLogic']
    let baseCurrency = ruleInstance.baseCurrency
    let logicAggregationVariables: RuleAggregationVariable[] = []

    const v2RuleInstance = isV2RuleInstance(ruleInstance)
    if (!v2RuleInstance) {
      throw new Error('Rule instance is not a v2 rule instance')
    }
    if (!ruleId) {
      throw new Error('Rule ID is required for v2 rule instance')
    }

    if (isEmpty(ruleInstance.parameters)) {
      ruleInstance.parameters =
        ruleInstance.riskLevelParameters?.[DEFAULT_RISK_LEVEL]
    }

    migratedData = getMigratedV8Config(
      ruleId,
      ruleInstance.parameters,
      ruleInstance.filters
    )

    logicAggregationVariables.push(
      ...(migratedData?.logicAggregationVariables ?? [])
    )

    if (!migratedData) {
      return
    }

    if (!baseCurrency && migratedData?.baseCurrency) {
      baseCurrency = migratedData.baseCurrency
    }

    if (hasFeature('RISK_LEVELS') && ruleInstance.riskLevelParameters) {
      v2RiskLevelLogic = Object.entries(
        ruleInstance.riskLevelParameters
      ).reduce((acc, [riskLevel, params]) => {
        const migratedDataByRiskLevel = getMigratedV8Config(
          ruleId,
          params,
          ruleInstance.filters
        )

        logicAggregationVariables.push(
          ...(migratedDataByRiskLevel?.logicAggregationVariables ?? [])
        )

        if (!migratedData) {
          migratedData = migratedDataByRiskLevel
        }

        if (!baseCurrency && migratedDataByRiskLevel?.baseCurrency) {
          baseCurrency = migratedDataByRiskLevel.baseCurrency
        }

        acc[riskLevel] = migratedDataByRiskLevel?.logic

        return acc
      }, {} as RiskLevelRuleLogic)
    }

    logicAggregationVariables = uniqBy(logicAggregationVariables, (v) => {
      return getAggVarHash(v, false)
    }).map((newAggVar) => {
      const existingAggVar = ruleInstance.logicAggregationVariables?.find(
        (existingAggVar) => {
          return (
            getAggVarHash(newAggVar, false) ===
            getAggVarHash(existingAggVar, false)
          )
        }
      )
      return {
        ...newAggVar,
        version: existingAggVar?.version,
      }
    })

    const logic: object =
      migratedData?.logic ?? Object.values(v2RiskLevelLogic ?? {})[0]

    const riskLevelLogic = v2RiskLevelLogic

    return { logic, riskLevelLogic, logicAggregationVariables, baseCurrency }
  }

  public async createOrUpdateRuleInstance(
    ruleInstance: RuleInstance,
    updatedAt?: number
  ): Promise<RuleInstance> {
    const ruleId = ruleInstance.ruleId ?? (await this.getNewCustomRuleId(true))

    if (envIsNot('test') && isV2RuleInstance(ruleInstance)) {
      ruleInstance = {
        ...ruleInstance,
        ...this.getV8PropsForV2RuleInstance(ruleInstance),
      }
    }

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

  public async updateRuleInstanceStatus(
    ruleInstanceId: string,
    status: RuleInstanceStatus
  ): Promise<void> {
    const updateItemInput: UpdateCommandInput = {
      TableName: StackConstants.TARPON_RULE_DYNAMODB_TABLE_NAME,
      Key: DynamoDbKeys.RULE_INSTANCE(this.tenantId, ruleInstanceId),
      UpdateExpression: `SET #status = :status`,
      ExpressionAttributeValues: {
        ':status': status,
      },
      ExpressionAttributeNames: {
        '#status': 'status',
      },
      ReturnValues: 'UPDATED_NEW',
    }
    await this.dynamoDb.send(new UpdateCommand(updateItemInput))
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
    const cacheKey = getInMemoryCacheKey(this.tenantId, type)
    if (activeRuleInstancesCache?.has(cacheKey)) {
      return activeRuleInstancesCache.get(cacheKey) as RuleInstance[]
    }

    const activeRuleInstances = await this.getRuleInstancesByStatus(
      ACTIVE_STATUS,
      type
    )
    activeRuleInstancesCache?.set(cacheKey, activeRuleInstances)
    return activeRuleInstances
  }

  public async getDeployingRuleInstances(
    type?: RuleType
  ): Promise<ReadonlyArray<RuleInstance>> {
    return this.getRuleInstancesByStatus(DEPLOYING_STATUS, type)
  }

  private async getRuleInstancesByStatus(
    status: RuleInstanceStatus,
    type?: RuleType
  ): Promise<ReadonlyArray<RuleInstance>> {
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

  public async getRuleInstancesUpdateData(
    ruleInstanceId: string,
    timeRange: { afterTimestamp: number; beforeTimestamp: number }
  ) {
    const db = await getMongoDbClientDb()
    const auditLogsCollection = db.collection(
      AUDITLOG_COLLECTION(this.tenantId)
    )
    const timezone = dayjsLib.tz.guess()
    const data = await auditLogsCollection
      .aggregate([
        {
          $match: {
            entityId: ruleInstanceId,
            type: 'RULE',
            action: 'UPDATE',
            timestamp: {
              $gte: timeRange.afterTimestamp,
              $lte: timeRange.beforeTimestamp,
            },
          },
        },
        {
          $sort: { timestamp: 1 },
        },
        {
          $project: {
            _id: false,
            date: {
              $dateToString: {
                format: DAY_DATE_FORMAT,
                date: { $toDate: '$timestamp' },
                timezone: timezone,
              },
            },
          },
        },
      ])
      .toArray()
    return uniq(data.map((d) => d.date))
  }
}
