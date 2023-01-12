import { publishAuditLog } from '../audit-log'
import {
  AuditLog,
  AuditLogActionEnum,
} from '@/@types/openapi-internal/AuditLog'
import { RuleInstance } from '@/@types/openapi-internal/RuleInstance'

type AuditLogCreateRequest = {
  ruleInstanceId?: string
  logAction: AuditLogActionEnum
  oldImage?: any
  newImage?: any
  ruleDetails: RuleInstance | null
}

export class RuleAuditLogService {
  tenantId: string

  constructor(tenantId: string) {
    this.tenantId = tenantId
  }

  private getRuleInstanceImage(ruleInstance: RuleInstance) {
    return {
      id: ruleInstance.id,
      ruleId: ruleInstance.ruleId,
      casePriority: ruleInstance.casePriority,
      ...ruleInstance.parameters,
      ruleAction: ruleInstance.action,
      caseCreationType: ruleInstance.caseCreationType,
      type: ruleInstance.type,
      ruleNameAlias: ruleInstance.ruleNameAlias,
      ruleDescripionAlias: ruleInstance.ruleDescriptionAlias,
      ...ruleInstance.filters,
      veryHighRiskLevelParameters: ruleInstance.riskLevelParameters?.VERY_HIGH,
      highRiskLevelParameters: ruleInstance.riskLevelParameters?.HIGH,
      mediumRiskLevelParameters: ruleInstance.riskLevelParameters?.MEDIUM,
      lowRiskLevelParameters: ruleInstance.riskLevelParameters?.LOW,
      veryLowRiskLevelParameters: ruleInstance.riskLevelParameters?.VERY_LOW,
      falsePositiveCheckEnabled: ruleInstance.falsePositiveCheckEnabled,
      status: ruleInstance.status,
    }
  }

  public async handleAuditLogForRuleInstanceCreated(
    ruleInstance: RuleInstance
  ): Promise<void> {
    const newImage = this.getRuleInstanceImage(ruleInstance)

    await this.createAuditLog({
      ruleInstanceId: ruleInstance?.id,
      logAction: 'CREATE',
      newImage,
      oldImage: {},
      ruleDetails: ruleInstance,
    })
  }

  public async handleAuditLogForRuleInstanceDeleted(
    ruleInstance: RuleInstance
  ): Promise<void> {
    const oldImage = this.getRuleInstanceImage(ruleInstance)

    await this.createAuditLog({
      ruleInstanceId: ruleInstance.id,
      logAction: 'DELETE',
      oldImage,
      newImage: {},
      ruleDetails: ruleInstance,
    })
  }

  public async handleAuditLogForRuleInstanceUpdated(
    oldInstance: RuleInstance | null,
    newInstance: RuleInstance | null
  ): Promise<void> {
    const oldImage = oldInstance ? this.getRuleInstanceImage(oldInstance) : {}
    const newImage = newInstance ? this.getRuleInstanceImage(newInstance) : {}

    await this.createAuditLog({
      ruleInstanceId: newInstance?.id,
      logAction: 'UPDATE',
      oldImage,
      newImage,
      ruleDetails: newInstance ?? null,
    })
  }

  private async createAuditLog(auditLogCreateRequest: AuditLogCreateRequest) {
    const { ruleInstanceId, logAction, oldImage, newImage, ruleDetails } =
      auditLogCreateRequest

    const auditLog: AuditLog = {
      type: 'RULE',
      entityId: ruleInstanceId,
      action: logAction,
      oldImage,
      newImage,
      logMetadata: {
        ruleId: ruleDetails?.ruleId,
        id: ruleDetails?.id,
      },
    }

    await publishAuditLog(this.tenantId, auditLog)
  }
}
