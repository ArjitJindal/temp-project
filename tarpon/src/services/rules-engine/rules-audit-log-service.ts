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

  public async handleAuditLogForRuleInstanceCreated(
    ruleInstance: RuleInstance
  ): Promise<void> {
    await this.createAuditLog({
      ruleInstanceId: ruleInstance?.id,
      logAction: 'CREATE',
      newImage: ruleInstance,
      oldImage: {},
      ruleDetails: ruleInstance,
    })
  }

  public async handleAuditLogForRuleInstanceDeleted(
    ruleInstance: RuleInstance
  ): Promise<void> {
    await this.createAuditLog({
      ruleInstanceId: ruleInstance.id,
      logAction: 'DELETE',
      oldImage: ruleInstance,
      newImage: {},
      ruleDetails: ruleInstance,
    })
  }

  public async handleAuditLogForRuleInstanceUpdated(
    oldInstance: RuleInstance | null,
    newInstance: RuleInstance | null
  ): Promise<void> {
    const oldImage = oldInstance ?? {}
    const newImage = newInstance ?? {}

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
