import omit from 'lodash/omit'
import { publishAuditLog } from '../audit-log'
import { AuditLog } from '@/@types/openapi-internal/AuditLog'
import { AuditLogActionEnum } from '@/@types/openapi-internal/AuditLogActionEnum'
import { RuleInstance } from '@/@types/openapi-internal/RuleInstance'
import { hasFeature } from '@/core/utils/context'
import { traceable } from '@/core/xray'

type AuditLogCreateRequest = {
  ruleInstanceId?: string
  logAction: AuditLogActionEnum
  oldImage?: any
  newImage?: any
  ruleDetails: RuleInstance | null
}

@traceable
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
    await this.createAuditLog({
      ruleInstanceId: newInstance?.id,
      logAction: 'UPDATE',
      oldImage: oldInstance,
      newImage: newInstance,
      ruleDetails: newInstance ?? null,
    })
  }

  private async createAuditLog(auditLogCreateRequest: AuditLogCreateRequest) {
    const { ruleInstanceId, logAction, oldImage, newImage, ruleDetails } =
      auditLogCreateRequest

    const parametersToOmit: (keyof RuleInstance)[] = hasFeature('RISK_LEVELS')
      ? ['parameters', 'action', 'triggersOnHit', 'logic']
      : [
          'riskLevelParameters',
          'riskLevelsTriggersOnHit',
          'riskLevelActions',
          'riskLevelLogic',
        ]

    const auditLog: AuditLog = {
      type: 'RULE',
      entityId: ruleInstanceId,
      action: logAction,
      oldImage: omit(oldImage, parametersToOmit),
      newImage: omit(newImage, parametersToOmit),
      logMetadata: {
        ruleId: ruleDetails?.ruleId,
        id: ruleDetails?.id,
      },
    }

    await publishAuditLog(this.tenantId, auditLog)
  }
}
