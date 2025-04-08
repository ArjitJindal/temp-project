import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb'
import { MongoClient } from 'mongodb'
import createHttpError, { NotFound } from 'http-errors'
import { keyBy, mapValues, mean, merge, sum, sumBy } from 'lodash'
import { AlertsRepository } from '../alerts/repository'
import { OverviewStatsDashboardMetric } from '../analytics/dashboard-metrics/overview-stats'
import { UserRepository } from '../users/repositories/user-repository'
import { getTimeLabels } from '../dashboard/utils'
import { DashboardStatsRepository } from '../dashboard/repositories/dashboard-stats-repository'
import { getLatestInvestigationTime } from '../cases/utils'
import { RuleInstanceRepository } from './repositories/rule-instance-repository'
import { RuleService } from './rule-service'
import { RuleAuditLogService } from './rules-audit-log-service'
import {
  assertValidRiskLevelParameters,
  isShadowRule,
  isV2RuleInstance,
  isV8RuleInstance,
  ruleInstanceAggregationVariablesRebuild,
  runOnV8Engine,
} from './utils'
import { RuleRepository } from './repositories/rule-repository'
import { TRANSACTION_RULES } from './transaction-rules'
import { USER_ONGOING_SCREENING_RULES, USER_RULES } from './user-rules'
import { MongoDbTransactionRepository } from './repositories/mongodb-transaction-repository'
import { V8_MIGRATED_RULES } from './v8-migrations'
import { PNB_INTERNAL_RULES } from './pnb-custom-logic'
import { RuleInstanceClickhouseRepository } from './repositories/rule-instance-clickhouse-repository'
import { RuleInstance } from '@/@types/openapi-internal/RuleInstance'
import { traceable } from '@/core/xray'
import { RuleType } from '@/@types/openapi-internal/RuleType'
import { RuleInstanceStats } from '@/@types/openapi-internal/RuleInstanceStats'
import { RuleInstanceExecutionStats } from '@/@types/openapi-internal/RuleInstanceExecutionStats'
import { DAY_DATE_FORMAT_JS } from '@/core/constants'
import { RuleInstanceAlertsStats } from '@/@types/openapi-internal/RuleInstanceAlertsStats'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { generateChecksum } from '@/utils/object'
import { logger } from '@/core/logger'
import dayjs from '@/utils/dayjs'
import { RuleRunMode } from '@/@types/openapi-internal/RuleRunMode'
import { hasFeature } from '@/core/utils/context'
import {
  getClickhouseClient,
  isClickhouseEnabled,
} from '@/utils/clickhouse/utils'

const ALL_RULES = {
  ...TRANSACTION_RULES,
  ...USER_RULES,
  ...USER_ONGOING_SCREENING_RULES,
}

@traceable
export class RuleInstanceService {
  tenantId: string
  mongoDb: MongoClient
  dynamoDb: DynamoDBDocumentClient
  ruleInstanceRepository: RuleInstanceRepository
  ruleAuditLogService: RuleAuditLogService
  ruleRepository: RuleRepository
  transactionRepository: MongoDbTransactionRepository
  usersRepository: UserRepository
  alertsRepository: AlertsRepository
  dashboardStatsRepository: DashboardStatsRepository

  constructor(
    tenantId: string,
    connections: { mongoDb: MongoClient; dynamoDb: DynamoDBDocumentClient }
  ) {
    this.tenantId = tenantId
    this.mongoDb = connections.mongoDb
    this.dynamoDb = connections.dynamoDb
    this.ruleInstanceRepository = new RuleInstanceRepository(
      tenantId,
      connections
    )
    this.ruleAuditLogService = new RuleAuditLogService(tenantId)
    this.ruleRepository = new RuleRepository(tenantId, connections)
    this.transactionRepository = new MongoDbTransactionRepository(
      tenantId,
      this.mongoDb,
      this.dynamoDb
    )
    this.usersRepository = new UserRepository(tenantId, {
      mongoDb: this.mongoDb,
    })
    this.alertsRepository = new AlertsRepository(this.tenantId, {
      mongoDb: this.mongoDb,
      dynamoDb: this.dynamoDb,
    })
    this.dashboardStatsRepository = new DashboardStatsRepository(
      this.tenantId,
      { mongoDb: this.mongoDb, dynamoDb: this.dynamoDb }
    )
  }

  public async getRuleInstanceById(ruleInstanceId: string) {
    const ruleInstance = await this.ruleInstanceRepository.getRuleInstanceById(
      ruleInstanceId
    )

    if (!ruleInstance) {
      throw new NotFound(`Rule instance ${ruleInstanceId} not found`)
    }

    return ruleInstance
  }

  public static async migrateV2RuleInstancesToV8(
    tenantId: string
  ): Promise<void> {
    const dynamoDb = getDynamoDbClient()
    const ruleInstanceRepository = new RuleInstanceRepository(tenantId, {
      dynamoDb,
    })

    const ruleInstances = await ruleInstanceRepository.getAllRuleInstances()

    for (const ruleInstance of ruleInstances) {
      const currentRuleV8Props = {
        logic: ruleInstance.logic,
        riskLevelLogic: ruleInstance.riskLevelLogic,
        baseCurrency: ruleInstance.baseCurrency,
        logicAggregationVariables: ruleInstance.logicAggregationVariables,
      }

      if (
        isV2RuleInstance(ruleInstance) &&
        V8_MIGRATED_RULES.includes(ruleInstance.ruleId as string)
      ) {
        const updatedRuleV8PProps =
          ruleInstanceRepository.getV8PropsForV2RuleInstance(ruleInstance)

        if (updatedRuleV8PProps) {
          await RuleService.validateRuleLogic(
            updatedRuleV8PProps.logic,
            updatedRuleV8PProps.riskLevelLogic,
            updatedRuleV8PProps.logicAggregationVariables,
            ruleInstance.logicEntityVariables
          )
        }
        if (
          !updatedRuleV8PProps ||
          generateChecksum(currentRuleV8Props) ===
            generateChecksum(updatedRuleV8PProps)
        ) {
          continue
        }
        logger.info(`Migrating rule instance ${ruleInstance.id} to V8`)

        await ruleInstanceRepository.createOrUpdateRuleInstance(
          {
            ...ruleInstance,
            ...updatedRuleV8PProps,
          },
          ruleInstance.updatedAt
        )
      }

      // Alert if rule instance is stuck in deploying state for more than 24 hours
      if (
        ruleInstance.status === 'DEPLOYING' &&
        dayjs().diff(ruleInstance.updatedAt, 'hour') >= 24
      ) {
        logger.error(
          `Rule instance ${ruleInstance.id} has been deploying for more than 24 hours`,
          { tenantId }
        )
      }
    }
  }

  public async putRuleInstance(
    ruleInstanceId: string,
    ruleInstance: RuleInstance
  ) {
    const oldRuleInstance = await this.getRuleInstanceById(ruleInstanceId)
    const newRuleInstance = await this.createOrUpdateRuleInstance({
      id: ruleInstanceId,
      ...ruleInstance,
      // NOTE: We don't allow updating rule stats from Console
      hitCount: oldRuleInstance?.hitCount,
      runCount: oldRuleInstance?.runCount,
    })

    if (oldRuleInstance?.queueId !== newRuleInstance.queueId) {
      await this.alertsRepository.updateRuleQueue(
        ruleInstanceId,
        newRuleInstance.queueId
      )
    }
    await this.ruleAuditLogService.handleAuditLogForRuleInstanceUpdated(
      oldRuleInstance,
      newRuleInstance
    )
    return newRuleInstance
  }

  public async deleteRuleInstance(ruleInstanceId: string) {
    const oldRuleInstance = await this.getRuleInstanceById(ruleInstanceId)

    await this.ruleInstanceRepository.deleteRuleInstance(ruleInstanceId)
    await this.ruleAuditLogService.handleAuditLogForRuleInstanceDeleted(
      oldRuleInstance
    )
  }

  async getActiveRuleInstances(
    type: RuleType
  ): Promise<ReadonlyArray<RuleInstance>> {
    return this.ruleInstanceRepository.getActiveRuleInstances(type)
  }

  async getAllRuleInstances(mode?: RuleRunMode): Promise<RuleInstance[]> {
    const allRuleInstances =
      await this.ruleInstanceRepository.getAllRuleInstances(mode)

    if (hasFeature('PNB')) {
      return allRuleInstances.filter(
        (ruleInstance) =>
          !PNB_INTERNAL_RULES.find(
            (internalRule) => internalRule.id === ruleInstance.id
          )
      )
    }
    return allRuleInstances
  }

  async createOrUpdateRuleInstance(
    ruleInstance: RuleInstance,
    updatedAt?: number
  ): Promise<RuleInstance> {
    const rule = ruleInstance.ruleId
      ? await this.ruleRepository.getRuleById(ruleInstance.ruleId)
      : undefined
    if (!isV8RuleInstance(ruleInstance) && !rule) {
      throw new createHttpError.BadRequest(
        `Rule ID ${ruleInstance.ruleId} not found`
      )
    }

    if (isV2RuleInstance(ruleInstance)) {
      assertValidRiskLevelParameters(
        ruleInstance.riskLevelActions,
        ruleInstance.riskLevelParameters
      )
      RuleService.validateRuleParametersSchema(
        ALL_RULES[rule?.ruleImplementationName ?? ''].getSchema(),
        ruleInstance.parameters,
        ruleInstance.riskLevelParameters
      )
    } else {
      await RuleService.validateRuleLogic(
        ruleInstance.logic,
        ruleInstance.riskLevelLogic,
        ruleInstance.logicAggregationVariables,
        ruleInstance.logicEntityVariables
      )
    }

    const now = Date.now()
    const updatedRuleInstance =
      await this.ruleInstanceRepository.createOrUpdateRuleInstance(
        { ...ruleInstance, type: ruleInstance.type, mode: ruleInstance.mode },
        updatedAt
      )

    if (runOnV8Engine(updatedRuleInstance)) {
      await ruleInstanceAggregationVariablesRebuild(
        updatedRuleInstance,
        now,
        this.tenantId,
        this.ruleInstanceRepository
      )
    }

    return updatedRuleInstance
  }

  public async createRuleInstance(ruleInstance: RuleInstance) {
    const newRuleInstance = await this.createOrUpdateRuleInstance(ruleInstance)
    await this.ruleAuditLogService.handleAuditLogForRuleInstanceCreated(
      newRuleInstance
    )
    return newRuleInstance
  }

  public async getNewRuleInstanceId(ruleId?: string): Promise<string> {
    return ruleId
      ? await this.ruleInstanceRepository.getNewRuleInstanceId(ruleId)
      : await this.ruleInstanceRepository.getNewCustomRuleId()
  }

  public async getRuleInstanceStats(
    ruleInstanceId: string,
    timeRange: { afterTimestamp: number; beforeTimestamp: number }
  ): Promise<RuleInstanceStats> {
    const ruleInstance = await this.getRuleInstanceById(ruleInstanceId)
    const isShadow = isShadowRule(ruleInstance)
    let transactionsHit: number | undefined = undefined
    let usersHit = 0
    let alertsHit = 0
    let investigationTime: number | undefined = undefined
    let executionStats: RuleInstanceExecutionStats[] = []
    let alertsStats: RuleInstanceAlertsStats[] = []
    const ruleInstanceUpdateStats =
      await this.ruleInstanceRepository.getRuleInstancesUpdateData(
        ruleInstanceId,
        timeRange
      )
    let stats: {
      [key: string]: {
        [key: string]: number
      }
    } = {}

    let clickhouseRepository: RuleInstanceClickhouseRepository | undefined
    if (isClickhouseEnabled()) {
      clickhouseRepository = new RuleInstanceClickhouseRepository(
        this.tenantId,
        {
          clickhouseClient: await getClickhouseClient(this.tenantId),
        }
      )
    }
    if (clickhouseRepository) {
      const { stats: clickhouseStats } =
        await clickhouseRepository.getRuleInstanceStats(
          ruleInstanceId,
          timeRange,
          ruleInstance,
          isShadow
        )
      stats = clickhouseStats
      transactionsHit = sumBy(Object.values(stats), 'hitCount')
    } else {
      if (ruleInstance.type === 'TRANSACTION') {
        const [hitStats, txStats] = await Promise.all([
          this.transactionRepository.getRuleInstanceHitStats(
            ruleInstanceId,
            timeRange,
            isShadow
          ),
          // NOTE: We use the dashboard transaction stats to get the transaction count as a performance
          // optimization to avoid scanning the transantions collection for the target time range
          this.dashboardStatsRepository.getTransactionCountStats(
            timeRange.afterTimestamp,
            timeRange.beforeTimestamp,
            'DAY'
          ),
        ])
        const runStats = mapValues(keyBy(txStats, 'time'), (v) => ({
          runCount: sum(
            Object.entries(v)
              .filter(([key]) => key.startsWith('status'))
              .map((v) => v[1])
          ),
        }))
        stats = merge(hitStats, runStats)
        transactionsHit = sumBy(Object.values(stats), 'hitCount')
      } else if (ruleInstance.type === 'USER') {
        stats = await this.usersRepository.getRuleInstanceStats(
          ruleInstanceId,
          timeRange,
          isShadow
        )
      } else {
        throw new Error('Unsupported rule type')
      }
    }

    const allTimeLabels = getTimeLabels(
      DAY_DATE_FORMAT_JS,
      timeRange.afterTimestamp,
      timeRange.beforeTimestamp,
      'DAY'
    )

    executionStats = allTimeLabels.map((timeLabel) => {
      if (!stats[timeLabel]) {
        return {
          date: timeLabel,
          runCount: 0,
          hitCount: 0,
        }
      }
      return {
        date: timeLabel,
        runCount: stats[timeLabel].runCount ?? 0,
        hitCount: stats[timeLabel].hitCount ?? 0,
      }
    })

    usersHit = sumBy(
      Object.values(stats),
      (v) =>
        (ruleInstance.type === 'TRANSACTION' ? v.hitUsersCount : v.hitCount) ??
        0
    )

    if (isShadow) {
      alertsHit = usersHit
      investigationTime = clickhouseRepository
        ? await OverviewStatsDashboardMetric.getAverageInvestigationTimeClickhouse(
            this.tenantId,
            'alerts'
          )
        : await OverviewStatsDashboardMetric.getAverageInvestigationTime(
            this.tenantId,
            'alerts'
          )
    } else {
      if (clickhouseRepository) {
        const alertStats = await clickhouseRepository.getAlertStats(
          ruleInstanceId,
          timeRange
        )
        alertsStats = allTimeLabels.map((timeLabel) => {
          const stat = alertStats.find((v) => v.date === timeLabel)
          return {
            date: timeLabel,
            alertsCreated: Number(stat?.alertsCreated ?? 0),
            falsePositiveAlerts: Number(stat?.falsePositiveAlerts ?? 0),
          }
        })
        const statusChangesData =
          await this.alertsRepository.getAlertsForInvestigationTimesClickhouse(
            ruleInstanceId,
            timeRange.afterTimestamp,
            timeRange.beforeTimestamp
          )
        const alertInvestigationTimes = statusChangesData
          .map((v) => getLatestInvestigationTime(v.statusChanges))
          .filter(Boolean)
        if (alertInvestigationTimes.length) {
          investigationTime = mean(alertInvestigationTimes)
        }
        alertsHit = sumBy(alertsStats, 'alertsCreated')
      } else {
        const stats = await this.alertsRepository.getRuleInstanceStats(
          ruleInstanceId,
          timeRange
        )
        alertsStats = allTimeLabels.map((timeLabel) => {
          const stat = stats.find((v) => v.date === timeLabel)
          return {
            date: timeLabel,
            alertsCreated: stat?.alertsCreated ?? 0,
            falsePositiveAlerts: stat?.falsePositiveAlerts ?? 0,
          }
        })
        const alertsResult = await this.alertsRepository.getAlerts({
          filterRulesHit: [ruleInstanceId],
          filterAlertAfterCreatedTimestamp: timeRange.afterTimestamp,
          filterAlertBeforeCreatedTimestamp: timeRange.beforeTimestamp,
        })
        const alertInvestigationTimes = alertsResult.data
          .map((v) => getLatestInvestigationTime(v.alert.statusChanges))
          .filter(Boolean)
        if (alertInvestigationTimes.length) {
          investigationTime = mean(alertInvestigationTimes)
        }
        alertsHit = alertsResult.total
      }
    }

    return {
      transactionsHit,
      usersHit,
      alertsHit,
      investigationTime,
      executionStats,
      alertsStats,
      ruleInstanceUpdateStats,
    }
  }

  public static async bumpV2RuleInstanceAggregationVersion(tenantId: string) {
    const dynamoDb = getDynamoDbClient()
    const ruleInstanceRepository = new RuleInstanceRepository(tenantId, {
      dynamoDb,
    })

    const ruleRepository = new RuleRepository(tenantId, {
      dynamoDb,
    })

    const ruleIds = (await ruleRepository.getAllRules()).map((rule) => rule.id)

    const ruleInstances = await ruleInstanceRepository.getAllRuleInstances()

    const ruleInstancesToUpdate = ruleInstances.filter(
      (ruleInstance) =>
        !!ruleInstance.ruleId && ruleIds.includes(ruleInstance.ruleId)
    )

    await Promise.all(
      ruleInstancesToUpdate.map((ruleInstance) =>
        ruleInstanceRepository.createOrUpdateRuleInstance(
          ruleInstance,
          (ruleInstance.updatedAt || 0) + 1
        )
      )
    )
  }

  public async preAggregateV2RuleInstance() {
    const ruleIds = (await this.ruleRepository.getAllRules()).map(
      (rule) => rule.id
    )
    const ruleInstances =
      await this.ruleInstanceRepository.getAllRuleInstances()
    const ruleInstancesToUpdate = ruleInstances.filter(
      (ruleInstance) =>
        !!ruleInstance.ruleId && ruleIds.includes(ruleInstance.ruleId)
    )

    for (const ruleInstance of ruleInstancesToUpdate) {
      if (ruleInstance.ruleId) {
        if (runOnV8Engine(ruleInstance)) {
          const originalStatus = ruleInstance.status
          if (originalStatus === 'ACTIVE') {
            await this.createOrUpdateRuleInstance(
              {
                ...ruleInstance,
                status: 'INACTIVE',
              },
              ruleInstance.updatedAt
            )
            await this.createOrUpdateRuleInstance(
              {
                ...ruleInstance,
                status: 'ACTIVE',
                logicAggregationVariables: undefined,
              },
              ruleInstance.updatedAt
            )
          }
        }
      }
    }
  }

  public async getDistinctRuleInstanceIdsWithAlerts(): Promise<string[]> {
    const distinctIds =
      await this.ruleInstanceRepository.getDistinctRuleInstanceIdsWithAlerts()
    return distinctIds
  }
}
