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
import { uniq, isEmpty, uniqBy, groupBy } from 'lodash'
import dayjsLib from '@flagright/lib/utils/dayjs'
import pMap from 'p-map'
import { replaceMagicKeyword } from '@flagright/lib/utils'
import { isV2RuleInstance } from '../utils'
import { RuleIdsFor314A } from '../utils/user-rule-utils'
import { getMigratedV8Config, V8_MIGRATED_RULES } from '../v8-migrations'
import { DynamoDbKeys } from '@/core/dynamodb/dynamodb-keys'
import { RuleInstance } from '@/@types/openapi-internal/RuleInstance'
import { paginateQuery } from '@/utils/dynamodb'
import { DEFAULT_RISK_LEVEL } from '@/services/risk-scoring/utils'
import { traceable } from '@/core/xray'
import { LogicAggregationVariable } from '@/@types/openapi-internal/LogicAggregationVariable'
import { RuleType } from '@/@types/openapi-internal/RuleType'
import { getMongoDbClient, getMongoDbClientDb } from '@/utils/mongodb-utils'
import { DAY_DATE_FORMAT } from '@/core/constants'
import { CounterRepository } from '@/services/counter/repository'
import { RuleInstanceStatus } from '@/@types/openapi-internal/RuleInstanceStatus'
import { AUDITLOG_COLLECTION } from '@/utils/mongodb-definitions'
import { hasFeature } from '@/core/utils/context'
import { RiskLevelRuleLogic } from '@/@types/openapi-internal/RiskLevelRuleLogic'
import { RuleStats } from '@/core/dynamodb/dynamodb-stream-consumer-builder'
import {
  createNonConsoleApiInMemoryCache,
  getInMemoryCacheKey,
} from '@/utils/memory-cache'
import { envIs, envIsNot } from '@/utils/env'
import { RuleRunMode } from '@/@types/openapi-internal/RuleRunMode'
import {
  AggregationRepository,
  getAggVarHash,
} from '@/services/logic-evaluator/engine/aggregation-repository'
import { getLogicAggVarsWithUpdatedVersion } from '@/utils/risk-rule-shared'
import { AuditLog } from '@/@types/openapi-internal/AuditLog'
// NOTE: We only cache active rule instances for 10 minutes in production -> After a rule instance
// is activated, it'll be effective after 10 minutes (worst case).
const ruleInstancesCache = envIs('prod')
  ? createNonConsoleApiInMemoryCache<readonly RuleInstance[]>({
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
    ruleExecutionMode: item.ruleExecutionMode,
    ruleRunMode: item.ruleRunMode,
    alertCreationOnHit: item.alertCreationOnHit,
    ruleRunFor: item.ruleRunFor,
    screeningAlertCreationLogic: item.screeningAlertCreationLogic,
  }
}

@traceable
export class RuleInstanceRepository {
  dynamoDb: DynamoDBDocumentClient
  tenantId: string
  aggregationRepository: AggregationRepository

  constructor(
    tenantId: string,
    connections: { dynamoDb: DynamoDBDocumentClient }
  ) {
    this.dynamoDb = connections.dynamoDb
    this.tenantId = tenantId
    this.aggregationRepository = new AggregationRepository(
      tenantId,
      this.dynamoDb
    )
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
    if (!V8_MIGRATED_RULES.includes(ruleInstance.ruleId ?? '')) {
      return
    }
    if (!isV2RuleInstance(ruleInstance)) {
      throw new Error('Rule instance is not a v2 rule instance')
    }
    const ruleId = ruleInstance.ruleId
    if (!ruleId) {
      throw new Error('Rule ID is required for v2 rule instance')
    }

    // Use default parameters if empty
    if (isEmpty(ruleInstance.parameters)) {
      ruleInstance.parameters =
        ruleInstance.riskLevelParameters?.[DEFAULT_RISK_LEVEL]
    }

    const migratedData = getMigratedV8Config(
      ruleId,
      ruleInstance.parameters,
      ruleInstance.filters
    )
    if (!migratedData) {
      return
    }

    let baseCurrency = ruleInstance.baseCurrency || migratedData.baseCurrency

    let logicAggregationVariables: LogicAggregationVariable[] = [
      ...(migratedData.logicAggregationVariables ?? []),
    ]

    let v2RiskLevelLogic = {} as RiskLevelRuleLogic
    if (hasFeature('RISK_LEVELS') && ruleInstance.riskLevelParameters) {
      Object.entries(ruleInstance.riskLevelParameters).forEach(
        ([riskLevel, params]) => {
          const migratedDataByRiskLevel = getMigratedV8Config(
            ruleId,
            params,
            ruleInstance.filters
          )
          if (!migratedDataByRiskLevel) {
            v2RiskLevelLogic = {
              ...v2RiskLevelLogic,
              [riskLevel]: undefined,
            } as RiskLevelRuleLogic
            return
          }
          logicAggregationVariables.push(
            ...(migratedDataByRiskLevel.logicAggregationVariables ?? [])
          )
          if (!baseCurrency && migratedDataByRiskLevel.baseCurrency) {
            baseCurrency = migratedDataByRiskLevel.baseCurrency
          }
          v2RiskLevelLogic = {
            ...v2RiskLevelLogic,
            [riskLevel]: migratedDataByRiskLevel.logic,
          } as RiskLevelRuleLogic
        }
      )
    }

    // Replace duplicate magic keywords in the main logic and risk-level logics
    const commonVarHashMap = groupBy(logicAggregationVariables, (aggVar) =>
      getAggVarHash(aggVar, false)
    )

    Object.values(commonVarHashMap).forEach((vars) => {
      const [mainVar, ...duplicates] = vars // Picking the first aggVar as uniqBy and groupBy both work with existing order
      if (migratedData?.logic) {
        migratedData.logic = duplicates.reduce(
          (logic, dupVar) =>
            replaceMagicKeyword(logic ?? {}, dupVar.key, mainVar.key),
          migratedData.logic
        )
      }
      if (v2RiskLevelLogic) {
        Object.keys(v2RiskLevelLogic).forEach((riskLevel) => {
          v2RiskLevelLogic[riskLevel] = duplicates.reduce(
            (logic, dupVar) =>
              replaceMagicKeyword(logic ?? {}, dupVar.key, mainVar.key),
            v2RiskLevelLogic[riskLevel]
          )
        })
      }
    })

    // Deduplicate aggregation variables
    logicAggregationVariables = uniqBy(logicAggregationVariables, (aggVar) =>
      getAggVarHash(aggVar, false)
    ).map((newAggVar) => {
      const existingAggVar = ruleInstance.logicAggregationVariables?.find(
        (existing) =>
          getAggVarHash(newAggVar, false) === getAggVarHash(existing, false)
      )
      return {
        ...newAggVar,
        version: existingAggVar?.version,
      }
    })

    const logic: object =
      migratedData?.logic ?? Object.values(v2RiskLevelLogic ?? {})[0]

    const alertConfig = {
      ...ruleInstance.alertConfig,
      ...(migratedData?.alertCreationDirection && {
        alertCreationDirection: migratedData.alertCreationDirection,
      }),
    }

    return {
      logic,
      riskLevelLogic: isEmpty(v2RiskLevelLogic) ? undefined : v2RiskLevelLogic,
      logicAggregationVariables,
      baseCurrency,
      alertConfig,
    }
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

    let ruleInstanceId = ruleInstance.id
    if (!ruleInstanceId) {
      ruleInstanceId = await this.getNewRuleInstanceId(ruleId, true)
      let existingRuleInstance = await this.getRuleInstanceById(ruleInstanceId)
      // NOTE: For most of the time this is not needed, but if we newly generated ID
      // is the same as the existing one, we need to generate a new one to avoid overwriting
      // the existing rule instance.
      if (existingRuleInstance) {
        ruleInstanceId = await this.getNewRuleInstanceId(ruleId, true)
        existingRuleInstance = await this.getRuleInstanceById(ruleInstanceId)
        if (existingRuleInstance) {
          throw new Error(`Rule instance already exists: ${ruleInstanceId}`)
        }
      }
    }

    let oldRuleInstance: RuleInstance | null = null
    if (ruleInstance.id) {
      oldRuleInstance = await this.getRuleInstanceById(ruleInstance.id)
    }
    const now = Date.now()
    const newRuleInstance: RuleInstance = {
      ...ruleInstance,
      // Save fallback parameters/action in case we remove PULSE feature flag
      logic:
        ruleInstance.logic ??
        Object.values(ruleInstance.riskLevelLogic ?? {})[0],
      logicAggregationVariables: await getLogicAggVarsWithUpdatedVersion(
        ruleInstance,
        ruleInstanceId,
        oldRuleInstance,
        this.aggregationRepository
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
    if (status === 'INACTIVE') {
      await this.deleteRuleInstanceFromUsedAggVars(ruleInstanceId)
    }
  }

  public async deleteRuleInstance(ruleInstanceId: string): Promise<void> {
    const deleteItemInput: DeleteCommandInput = {
      TableName: StackConstants.TARPON_RULE_DYNAMODB_TABLE_NAME,
      Key: DynamoDbKeys.RULE_INSTANCE(this.tenantId, ruleInstanceId),
    }
    await this.dynamoDb.send(new DeleteCommand(deleteItemInput))
    await this.deleteRuleInstanceFromUsedAggVars(ruleInstanceId)
  }

  public async deleteRuleInstanceFromUsedAggVars(
    ruleInstanceId: string
  ): Promise<void> {
    const ruleInstance = await this.getRuleInstanceById(ruleInstanceId)
    if (ruleInstance) {
      // This is will remove ruleInstance from all old usedAggVars
      await this.aggregationRepository.updateLogicAggVars(
        undefined,
        ruleInstanceId,
        ruleInstance
      )
    }
  }

  public async getActiveRuleInstances(
    type?: RuleType
  ): Promise<ReadonlyArray<RuleInstance>> {
    return await this.getRuleInstancesByStatus(ACTIVE_STATUS, type)
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
    const cacheKey = getInMemoryCacheKey(this.tenantId, status, type)
    if (ruleInstancesCache?.has(cacheKey)) {
      return ruleInstancesCache.get(cacheKey) as RuleInstance[]
    }

    const ruleInstances = await this.getRuleInstances({
      FilterExpression: '#status = :status',
      ExpressionAttributeValues: {
        ':status': status,
      },
      ExpressionAttributeNames: {
        '#status': 'status',
      },
    })
    const result = type
      ? ruleInstances.filter((r) => r.type === type)
      : ruleInstances
    ruleInstancesCache?.set(cacheKey, result)
    return result
  }

  public async getAllRuleInstances(
    mode?: RuleRunMode
  ): Promise<RuleInstance[]> {
    if (mode) {
      const filterExpression = '#ruleRunMode = :ruleRunMode'
      const expressionAttributeValues = { ':ruleRunMode': mode }
      const expressionAttributeNames = { '#ruleRunMode': 'ruleRunMode' }

      return this.getRuleInstances({
        FilterExpression: filterExpression,
        ExpressionAttributeValues: expressionAttributeValues,
        ExpressionAttributeNames: expressionAttributeNames,
      })
    }

    return this.getRuleInstances({})
  }

  public async getRuleInstanceById(
    ruleInstanceId: string
  ): Promise<RuleInstance | null> {
    const getItemInput: GetCommandInput = {
      TableName: StackConstants.TARPON_RULE_DYNAMODB_TABLE_NAME,
      Key: DynamoDbKeys.RULE_INSTANCE(this.tenantId, ruleInstanceId),
      ConsistentRead: true,
    }
    const result = await this.dynamoDb.send(new GetCommand(getItemInput))
    return result.Item ? toRuleInstance(result.Item) : null
  }

  async getRuleInstancesByRuleIds(
    ruleIds: string[]
  ): Promise<Array<RuleInstance>> {
    if (ruleIds.length === 0) {
      return []
    }
    const expressionAttributeValues = {}
    const filterValues: string[] = []
    ruleIds.forEach((id, idx) => {
      const key = `:r${idx}`
      expressionAttributeValues[key] = id
      filterValues.push(key)
    })
    const filterExpression = `ruleId IN (${filterValues.join(',')})`
    return this.getRuleInstances({
      FilterExpression: filterExpression,
      ExpressionAttributeValues: expressionAttributeValues,
    })
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

  public async get314AIdsBasedOnAttachedList(listId: string) {
    const ruleInstances = await this.getRuleInstancesByRuleIds(RuleIdsFor314A)
    const ruleIdsToTrigger: string[] = []

    ruleInstances.forEach((rule: RuleInstance) => {
      const riskLevels = Object.keys(rule?.riskLevelParameters ?? {})
      for (let i = 0; i < riskLevels.length; i++) {
        const riskLevelConfig = rule?.riskLevelParameters?.[riskLevels[i]]
        if (riskLevelConfig.listId === listId && rule.id) {
          ruleIdsToTrigger.push(rule.id)
          // breaking here so that there is just one instance of a rule id to trigger
          break
        }
      }
    })
    return ruleIdsToTrigger
  }

  public async updateRuleInstancesStats(ruleStats: RuleStats[]) {
    const updates = new Map<
      string,
      {
        hitCountDelta: number
        runCountDelta: number
      }
    >()
    for (const stat of ruleStats) {
      stat.executedRulesInstanceIds?.map((id) => {
        updates.set(id, {
          runCountDelta: (updates.get(id)?.runCountDelta ?? 0) + 1,
          hitCountDelta: 0,
        })
      })
      stat.hitRulesInstanceIds?.map((id) => {
        const update = updates.get(id)
        updates.set(id, {
          hitCountDelta: (update?.hitCountDelta ?? 0) + 1,
          runCountDelta: update?.runCountDelta ?? 0,
        })
      })
    }
    await this.updateRuleInstanceStatsCount(Object.fromEntries(updates))
  }

  public async updateRuleInstanceStatsCount(updates: {
    [key: string]: {
      hitCountDelta: number
      runCountDelta: number
    }
  }) {
    const now = Date.now()
    await pMap(
      Object.keys(updates),
      async (runRuleInstanceId) => {
        const updateItemInput: UpdateCommandInput = {
          TableName: StackConstants.TARPON_RULE_DYNAMODB_TABLE_NAME,
          Key: DynamoDbKeys.RULE_INSTANCE(this.tenantId, runRuleInstanceId),
          UpdateExpression: `SET runCount = if_not_exists(runCount, :zero) + :runCountInc, hitCount = if_not_exists(hitCount, :zero) + :hitCountInc, ruleRunTime = :now`,
          ExpressionAttributeValues: {
            ':runCountInc': updates[runRuleInstanceId].runCountDelta,
            ':hitCountInc': updates[runRuleInstanceId].hitCountDelta,
            ':zero': 0,
            ':now': now,
          },
          ReturnValues: 'UPDATED_NEW',
        }
        return this.dynamoDb.send(new UpdateCommand(updateItemInput))
      },
      { concurrency: 5 }
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

  public async getDistinctRuleInstanceIdsWithAlerts(): Promise<string[]> {
    const [liveRuleInstances, shadowRuleInstances] = await Promise.all([
      this.getAllRuleInstances('LIVE'),
      this.getAllRuleInstances('SHADOW'),
    ])
    const shadowRuleInstanceIds = shadowRuleInstances
      .filter((ruleInstance) => ruleInstance.id && ruleInstance.hitCount)
      .map((ruleInstance) => ruleInstance.id)
    const db = await getMongoDbClientDb()
    const auditLogCollection = db.collection<AuditLog>(
      AUDITLOG_COLLECTION(this.tenantId)
    )
    const auditLogs = await auditLogCollection
      .find({
        entityId: { $in: shadowRuleInstanceIds },
        action: 'UPDATE',
      })
      .toArray()
    const distinctShadowRuleInstanceIds = new Set(
      liveRuleInstances
        .filter((r) => r.hitCount)
        .map((ruleInstance) => ruleInstance.id)
    )
    auditLogs.map((auditLog) => {
      if (auditLog?.oldImage?.ruleRunMode === 'LIVE') {
        distinctShadowRuleInstanceIds.add(auditLog.entityId)
      }
    })
    return Array.from(distinctShadowRuleInstanceIds).filter(Boolean) as string[]
  }
}
