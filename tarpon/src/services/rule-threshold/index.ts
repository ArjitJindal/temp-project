import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb'
import { MongoClient } from 'mongodb'
import chunk from 'lodash/chunk'
import { CaseRepository } from '../cases/repository'
import { TenantRepository } from '../tenants/repositories/tenant-repository'
import { MongoDbTransactionRepository } from '../rules-engine/repositories/mongodb-transaction-repository'
import { AlertsRepository } from '../alerts/repository'
import { RuleInstanceService } from '../rules-engine/rule-instance-service'
import { DispositionState, VarData, VarOptimizationData } from './types'
import { RuleThresholdOptimizerRepository } from './repository'
import {
  augmentVarData,
  FP_REASONS,
  getNumericVarKeyData,
  getNumericVarKeys,
  mergeData,
  processTransactionVars,
  sanitizeVarData,
} from './utils'
import { generateDemoThresholdData } from './demo-threshold-recommendation'
import { Alert } from '@/@types/openapi-internal/Alert'
import { RuleInstance } from '@/@types/openapi-internal/RuleInstance'
import { traceable } from '@/core/xray'
import { RiskLevel } from '@/@types/openapi-public/RiskLevel'
import { InternalConsumerUser } from '@/@types/openapi-internal/InternalConsumerUser'
import { InternalBusinessUser } from '@/@types/openapi-internal/InternalBusinessUser'
import { ActionReason } from '@/@types/openapi-internal/ActionReason'
import { logger } from '@/core/logger'
import { updateLogMetadata } from '@/core/utils/context'
import { RuleThresholdRecommendations } from '@/@types/openapi-internal/RuleThresholdRecommendations'
import { VarThresholdData } from '@/@types/openapi-internal/VarThresholdData'
import { isDemoMode } from '@/utils/demo'
import {
  getClickhouseClient,
  isConsoleMigrationEnabled,
} from '@/utils/clickhouse/utils'
import { ClickhouseAlertRepository } from '@/services/alerts/clickhouse-repository'
import { RuleInstanceStats } from '@/@types/openapi-internal/RuleInstanceStats'
import dayjs from '@/utils/dayjs'

const MIN_DISPOSED_LIMIT = 15

@traceable
export class RuleThresholdOptimizer {
  private tenantId: string
  private dynamoDb: DynamoDBDocumentClient
  private mongoDb: MongoClient
  private caseRepository: CaseRepository
  private tenantRepository: TenantRepository
  private mongoTransactionsRepository: MongoDbTransactionRepository
  private ruleThresholdOptimizerRepository: RuleThresholdOptimizerRepository
  private alertsRepository: AlertsRepository
  private clickhouseAlertRepository?: ClickhouseAlertRepository

  constructor(
    tenantId: string,
    connections: { dynamoDb: DynamoDBDocumentClient; mongoDb: MongoClient }
  ) {
    this.tenantId = tenantId
    this.dynamoDb = connections.dynamoDb
    this.mongoDb = connections.mongoDb
    this.caseRepository = new CaseRepository(this.tenantId, {
      mongoDb: this.mongoDb,
      dynamoDb: this.dynamoDb,
    })
    this.tenantRepository = new TenantRepository(this.tenantId, {
      dynamoDb: this.dynamoDb,
      mongoDb: this.mongoDb,
    })
    this.mongoTransactionsRepository = new MongoDbTransactionRepository(
      this.tenantId,
      this.mongoDb,
      this.dynamoDb
    )
    this.ruleThresholdOptimizerRepository =
      new RuleThresholdOptimizerRepository(this.tenantId, this.dynamoDb)

    this.alertsRepository = new AlertsRepository(this.tenantId, {
      mongoDb: this.mongoDb,
      dynamoDb: this.dynamoDb,
    })
  }
  /**
   * Get the clickhouse alert repository.
   * Since we cannot initialize the repository in the constructor, we need to initialize it here.
   * If the repository is already initialized, it will return the existing repository.\
   * Otherwise, it will initialize a new repository and return it.
   *
   * @returns The clickhouse alert repository
   */
  private async getClickhouseAlertRepository(): Promise<ClickhouseAlertRepository> {
    if (this.clickhouseAlertRepository) {
      return this.clickhouseAlertRepository
    }
    const clickhouse = await getClickhouseClient(this.tenantId)
    this.clickhouseAlertRepository = new ClickhouseAlertRepository(
      this.tenantId,
      {
        clickhouseClient: clickhouse,
        dynamoDb: this.dynamoDb,
      }
    )
    return this.clickhouseAlertRepository
  }

  public async getRecommendedThresholdData(
    ruleInstanceId: string
  ): Promise<RuleThresholdRecommendations> {
    const isDemo = isDemoMode()
    const ruleInstanceService = new RuleInstanceService(this.tenantId, {
      mongoDb: this.mongoDb,
      dynamoDb: this.dynamoDb,
    })
    const [ruleInstance, currentInstanceStats] = await Promise.all([
      ruleInstanceService.getRuleInstanceById(ruleInstanceId),
      ruleInstanceService.getRuleInstanceStats(ruleInstanceId, {
        afterTimestamp: dayjs().subtract(1, 'year').valueOf(),
        beforeTimestamp: Date.now(),
      }),
    ])
    if (isDemo) {
      const data = getNumericVarKeyData(ruleInstance?.logic)
      const newThresholdsData = data.map((value) => {
        return generateDemoThresholdData(value, currentInstanceStats)
      })
      return {
        ruleInstanceId: ruleInstanceId,
        varsThresholdData: newThresholdsData,
        isReady: true,
      }
    }
    let disposedAlertsCount: number
    if (isConsoleMigrationEnabled()) {
      const clickhouseAlertRepository =
        await this.getClickhouseAlertRepository()
      disposedAlertsCount = await clickhouseAlertRepository.getAlertsCount({
        filterRuleInstanceId: [ruleInstanceId],
        filterAlertStatus: ['CLOSED'],
      })
    } else {
      const pipeline = await this.alertsRepository.getAlertsPipeline(
        {
          filterRuleInstanceId: [ruleInstanceId],
          filterAlertStatus: ['CLOSED'],
        },
        { countOnly: true }
      )
      disposedAlertsCount = await this.alertsRepository.getAlertsCount(pipeline)
    }
    const isReady = disposedAlertsCount >= MIN_DISPOSED_LIMIT
    if (!isReady) {
      return {
        ruleInstanceId: ruleInstanceId,
        varsThresholdData: [],
        isReady: isReady,
      }
    }
    // Check whether min,max guardrails needed or not

    const optimizationData =
      await this.ruleThresholdOptimizerRepository.getRuleInstanceThresholdData(
        ruleInstanceId
      )

    const thresholdData = await Promise.all(
      optimizationData?.variablesOptimizationData.map(async (val) => {
        return await this.generateRecommendationData(
          val,
          currentInstanceStats,
          ruleInstance
        )
      }) ?? []
    )
    return {
      ruleInstanceId: ruleInstanceId,
      varsThresholdData: thresholdData,
      isReady: isReady,
    }
  }

  public async generateRecommendationData(
    data: VarOptimizationData,
    currentRuleInstanceStats: RuleInstanceStats,
    ruleInstance: RuleInstance
  ): Promise<VarThresholdData> {
    const threshold = this.calculateThreshold(data)
    const fpCount = data.FP?.count ?? 0
    const falsePositivesReduced = fpCount
    const timeReduced =
      (currentRuleInstanceStats.investigationTime ?? 0) * falsePositivesReduced
    const transactionsHit = (data.TP?.count ?? 0) + fpCount
    const alertCreationDirection =
      ruleInstance.alertConfig?.alertCreationDirection
    let additionalHits = fpCount

    if (
      !alertCreationDirection ||
      ['ALL', 'AUTO'].includes(alertCreationDirection)
    ) {
      additionalHits = 2 * fpCount
    }

    const usersHit = (currentRuleInstanceStats.usersHit ?? 0) + additionalHits
    return {
      varKey: data.varKey,
      threshold,
      usersHit,
      transactionsHit,
      falsePositivesReduced,
      timeReduced,
    }
  }

  public calculateThreshold(data: VarOptimizationData): number {
    const calcStats = (d: typeof data.FP) => {
      const mean = (d?.sum ?? 0) / (d?.count || 1)
      const variance = (d?.sumOfSquares ?? 0) / (d?.count || 1) - mean * mean
      return {
        mean,
        stdDev: Number(Math.sqrt(Math.max(0, variance)).toFixed(4)),
      }
    }
    const { mean: FpMean, stdDev: FpStdDev } = calcStats(data.FP)
    const { mean: TpMean, stdDev: TpStdDev } = calcStats(data.TP)
    return parseFloat(
      (TpMean + (TpMean - FpMean) * (TpStdDev / (FpStdDev + 1))).toFixed(4)
    )
  }

  private async getRiskLevel(
    alert: Alert,
    isRiskLevelsEnabled?: boolean
  ): Promise<RiskLevel | undefined> {
    if (!isRiskLevelsEnabled || !alert.caseId) {
      return undefined
    }

    const c = await this.caseRepository.getCaseById(alert.caseId)
    const user = (c?.caseUsers?.origin ?? c?.caseUsers?.destination) as
      | InternalConsumerUser
      | InternalBusinessUser
      | undefined
    return user?.riskLevel
  }

  private getDispositionState(reasonData: ActionReason): DispositionState {
    return reasonData.reasons.some((val) => FP_REASONS.includes(val))
      ? 'FP'
      : 'TP'
  }

  private getRuleLogic(ruleInstance: RuleInstance, riskLevel?: RiskLevel) {
    return riskLevel
      ? ruleInstance.riskLevelLogic?.[riskLevel] ?? ruleInstance.logic
      : ruleInstance.logic
  }

  public async processDisposition(data: {
    alert: Alert
    ruleInstance: RuleInstance
    reasonData: ActionReason
  }) {
    const { alert, ruleInstance, reasonData } = data
    updateLogMetadata({
      tenantId: this.tenantId,
      alertId: alert._id,
    })
    logger.info(
      `Processing alert with id: ${alert._id},RCid: ${ruleInstance.id} `
    )
    if (!ruleInstance.id || !alert.caseId) {
      return
    }

    const features = (
      await this.tenantRepository.getTenantSettings(['features'])
    ).features
    const isRiskLevelsEnabled = features?.includes('RISK_LEVELS')

    const state = this.getDispositionState(reasonData)
    const riskLevel = await this.getRiskLevel(alert, isRiskLevelsEnabled)
    const logic = this.getRuleLogic(ruleInstance, riskLevel)

    const numericVarKeys = getNumericVarKeys(logic)
    if (numericVarKeys.length === 0 || !alert.transactionIds?.length) {
      return
    }

    const varData = await this.processAlertTransactions(
      alert.transactionIds,
      numericVarKeys,
      ruleInstance.id
    )

    const augmentedVarData = augmentVarData(varData)
    const existingData =
      await this.ruleThresholdOptimizerRepository.getRuleInstanceThresholdData(
        ruleInstance.id
      )

    const newData = mergeData(
      existingData ?? {
        ruleInstanceId: ruleInstance.id,
        variablesOptimizationData: [],
        updatedAt: Date.now(),
      },
      augmentedVarData,
      state
    )
    await this.ruleThresholdOptimizerRepository.updateorCreateRuleInstanceThresholdData(
      ruleInstance.id,
      newData
    )
  }

  public async processAlertTransactions(
    transactionIds: string[],
    varKeys: string[],
    ruleInstanceId: string
  ) {
    const varData: VarData = {}

    for (const txIds of chunk(transactionIds, 20)) {
      const transactions =
        await this.mongoTransactionsRepository.getTransactionsByIds(txIds)

      for (const transaction of transactions) {
        const vars =
          transaction.executedRules.find(
            (rule) => rule.ruleInstanceId === ruleInstanceId
          )?.vars || []

        if (vars.length === 0) {
          continue
        }

        processTransactionVars(vars, varKeys, varData)
      }
    }

    return sanitizeVarData(varData)
  }
}
