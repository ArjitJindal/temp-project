import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb'
import { MongoClient } from 'mongodb'
import createHttpError, { NotFound } from 'http-errors'
import { keyBy, mapValues, mean, merge, sum, sumBy } from 'lodash'
import { AlertsRepository } from '../alerts/repository'
import { sendBatchJobCommand } from '../batch-jobs/batch-job'
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
  isV8RuleInstance,
} from './utils'
import { RuleRepository } from './repositories/rule-repository'
import { TRANSACTION_RULES } from './transaction-rules'
import { USER_ONGOING_SCREENING_RULES, USER_RULES } from './user-rules'
import { MongoDbTransactionRepository } from './repositories/mongodb-transaction-repository'
import { RuleInstance } from '@/@types/openapi-internal/RuleInstance'
import { traceable } from '@/core/xray'
import { RuleType } from '@/@types/openapi-internal/RuleType'
import { RuleMode } from '@/@types/openapi-internal/RuleMode'
import { RuleInstanceStats } from '@/@types/openapi-internal/RuleInstanceStats'
import { RuleInstanceExecutionStats } from '@/@types/openapi-internal/RuleInstanceExecutionStats'
import { DAY_DATE_FORMAT_JS } from '@/utils/mongodb-utils'

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
      this.mongoDb
    )
    this.usersRepository = new UserRepository(tenantId, {
      mongoDb: this.mongoDb,
    })
    this.alertsRepository = new AlertsRepository(this.tenantId, {
      mongoDb: this.mongoDb,
    })
    this.dashboardStatsRepository = new DashboardStatsRepository(tenantId, {
      mongoDb: this.mongoDb,
    })
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

  async getAllRuleInstances(mode?: RuleMode): Promise<RuleInstance[]> {
    return this.ruleInstanceRepository.getAllRuleInstances(mode)
  }

  async createOrUpdateRuleInstance(
    ruleInstance: RuleInstance
  ): Promise<RuleInstance> {
    const rule = ruleInstance.ruleId
      ? await this.ruleRepository.getRuleById(ruleInstance.ruleId)
      : undefined
    if (!isV8RuleInstance(ruleInstance) && !rule) {
      throw new createHttpError.BadRequest(
        `Rule ID ${ruleInstance.ruleId} not found`
      )
    }

    if (!isV8RuleInstance(ruleInstance)) {
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
        ruleInstance.logicAggregationVariables
      )
    }

    const now = Date.now()
    const updatedRuleInstance =
      await this.ruleInstanceRepository.createOrUpdateRuleInstance(
        { ...ruleInstance, type: ruleInstance.type, mode: ruleInstance.mode },
        undefined
      )

    const aggVarsToRebuild =
      updatedRuleInstance.logicAggregationVariables?.filter(
        (aggVar) => aggVar.version && aggVar.version > now
      ) ?? []

    if (aggVarsToRebuild.length > 0) {
      // TODO (FR-2917): Change rule instance status to DEPLOYING
      await sendBatchJobCommand({
        type: 'RULE_PRE_AGGREGATION',
        tenantId: this.tenantId,
        parameters: {
          ruleInstanceId: updatedRuleInstance.id as string,
          aggregationVariables: aggVarsToRebuild,
        },
      })
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
    let stats: {
      [key: string]: {
        [key: string]: number
      }
    } = {}
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
      ruleInstance.type === 'TRANSACTION' ? 'hitUsersCount' : 'hitCount'
    )

    if (isShadow) {
      alertsHit = usersHit
      investigationTime =
        await OverviewStatsDashboardMetric.getAverageInvestigationTime(
          this.tenantId,
          'alerts'
        )
    } else {
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
    return {
      transactionsHit,
      usersHit,
      alertsHit,
      investigationTime,
      executionStats,
    }
  }
}
