import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb'
import { MongoClient } from 'mongodb'
import createHttpError, { NotFound } from 'http-errors'
import { RuleInstanceRepository } from './repositories/rule-instance-repository'
import { RuleService } from './rule-service'
import { RuleAuditLogService } from './rules-audit-log-service'
import { AlertsRepository } from './repositories/alerts-repository'
import { assertValidRiskLevelParameters, isV8RuleInstance } from './utils'
import { RuleRepository } from './repositories/rule-repository'
import { TRANSACTION_RULES } from './transaction-rules'
import { USER_RULES } from './user-rules'
import { RuleInstance } from '@/@types/openapi-internal/RuleInstance'
import { traceable } from '@/core/xray'
import { RuleType } from '@/@types/openapi-internal/RuleType'

const ALL_RULES = {
  ...TRANSACTION_RULES,
  ...USER_RULES,
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

    const newRuleInstance = await this.createOrUpdateRuleInstance(
      {
        id: ruleInstanceId,
        ...ruleInstance,
        // NOTE: We don't allow updating rule stats from Console
        hitCount: oldRuleInstance?.hitCount,
        runCount: oldRuleInstance?.runCount,
      },
      'UPDATE'
    )

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

  async getAllRuleInstances(): Promise<RuleInstance[]> {
    return this.ruleInstanceRepository.getAllRuleInstances()
  }

  async createOrUpdateRuleInstance(
    ruleInstance: RuleInstance,
    action?: 'CREATE' | 'UPDATE'
  ): Promise<RuleInstance> {
    const rule = ruleInstance.ruleId
      ? await this.ruleRepository.getRuleById(ruleInstance.ruleId)
      : null
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
        ALL_RULES[rule!.ruleImplementationName!].getSchema(),
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
    return this.ruleInstanceRepository.createOrUpdateRuleInstance(
      {
        ...ruleInstance,
        type,
      },
      undefined,
      action === 'CREATE'
    )
  }

  public async createRuleInstance(ruleInstance: RuleInstance) {
    const newRuleInstance = await this.createOrUpdateRuleInstance(
      ruleInstance,
      'CREATE'
    )
    await this.ruleAuditLogService.handleAuditLogForRuleInstanceCreated(
      newRuleInstance
    )
    return newRuleInstance
  }

  public async getNewRuleInstanceId(ruleId?: string): Promise<string> {
    return this.ruleInstanceRepository.getNewRuleInstanceId(ruleId)
  }
}
