import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb'
import { MongoClient } from 'mongodb'
import createHttpError, { NotFound } from 'http-errors'
import { AlertsRepository } from '../alerts/repository'
import { sendBatchJobCommand } from '../batch-jobs/batch-job'
import { RuleInstanceRepository } from './repositories/rule-instance-repository'
import { RuleService } from './rule-service'
import { RuleAuditLogService } from './rules-audit-log-service'
import { assertValidRiskLevelParameters, isV8RuleInstance } from './utils'
import { RuleRepository } from './repositories/rule-repository'
import { TRANSACTION_RULES } from './transaction-rules'
import { USER_ONGOING_SCREENING_RULES, USER_RULES } from './user-rules'
import { RuleInstance } from '@/@types/openapi-internal/RuleInstance'
import { traceable } from '@/core/xray'
import { RuleType } from '@/@types/openapi-internal/RuleType'
import { RuleMode } from '@/@types/openapi-internal/RuleMode'

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

    const alertsRepository = new AlertsRepository(this.tenantId, {
      mongoDb: this.mongoDb,
    })

    if (oldRuleInstance?.queueId !== newRuleInstance.queueId) {
      await alertsRepository.updateRuleQueue(
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

    // TODO (V8): FR-3985
    const type = rule ? rule.type : 'TRANSACTION'
    const now = Date.now()
    const updatedRuleInstance =
      await this.ruleInstanceRepository.createOrUpdateRuleInstance(
        { ...ruleInstance, type, mode: ruleInstance.mode },
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
}
