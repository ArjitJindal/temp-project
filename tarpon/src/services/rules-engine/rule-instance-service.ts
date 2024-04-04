import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb'
import { MongoClient } from 'mongodb'
import { NotFound } from 'http-errors'
import { RuleInstanceRepository } from './repositories/rule-instance-repository'
import { RuleService } from './rule-service'
import { RuleAuditLogService } from './rules-audit-log-service'
import { AlertsRepository } from './repositories/alerts-repository'
import { RuleInstance } from '@/@types/openapi-internal/RuleInstance'
import { traceable } from '@/core/xray'

@traceable
export class RuleInstanceService {
  tenantId: string
  mongoDb: MongoClient
  dynamoDb: DynamoDBDocumentClient
  ruleInstanceRepository: RuleInstanceRepository
  ruleService: RuleService
  ruleAuditLogService: RuleAuditLogService

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
    this.ruleService = new RuleService(tenantId, connections)
    this.ruleAuditLogService = new RuleAuditLogService(tenantId)
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

    const newRuleInstance = await this.ruleService.createOrUpdateRuleInstance({
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

    await this.ruleService.deleteRuleInstance(ruleInstanceId)
    await this.ruleAuditLogService.handleAuditLogForRuleInstanceDeleted(
      oldRuleInstance
    )
  }

  async getAllRuleInstances(): Promise<RuleInstance[]> {
    return this.ruleInstanceRepository.getAllRuleInstances()
  }

  public async createRuleInstance(ruleInstance: RuleInstance) {
    const newRuleInstance = await this.ruleService.createOrUpdateRuleInstance(
      ruleInstance
    )
    await this.ruleAuditLogService.handleAuditLogForRuleInstanceCreated(
      newRuleInstance
    )
    return newRuleInstance
  }
}
