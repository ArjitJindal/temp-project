import {
  AuditLog,
  AuditLogActionEnum,
  AuditLogSubtypeEnum,
} from '@/@types/openapi-internal/AuditLog'
import { DrsScore } from '@/@types/openapi-internal/DrsScore'
import { ParameterAttributeRiskValues } from '@/@types/openapi-internal/ParameterAttributeRiskValues'
import { RiskClassificationScore } from '@/@types/openapi-internal/RiskClassificationScore'
import { publishAuditLog } from '@/services/audit-log'

type AuditLogCreateRequest = {
  instanceId?: string
  logAction: AuditLogActionEnum
  oldImage?: any
  newImage?: any
  logMetadata?: any
  subtype?: AuditLogSubtypeEnum
}

export class PulseAuditLogService {
  tenantId: string

  constructor(tenantId: string) {
    this.tenantId = tenantId
  }

  public async handleAuditLogForRiskClassificationsUpdated(
    oldRiskClassificationScore: RiskClassificationScore[] | undefined,
    newRiskClassificationScore: RiskClassificationScore[] | undefined
  ): Promise<void> {
    await this.createAuditLog({
      logAction: 'UPDATE',
      oldImage: oldRiskClassificationScore ?? {},
      newImage: newRiskClassificationScore ?? {},
      logMetadata: {
        riskClassificationScore: newRiskClassificationScore,
      },
      subtype: 'RISK_CLASSIFICATION',
    })
  }

  public async handleDrsUpdate(
    oldDrsScore: DrsScore | null,
    newDrsScore: DrsScore | null,
    type: 'MANUAL' | 'AUTOMATIC'
  ) {
    if (
      !oldDrsScore ||
      oldDrsScore?.manualRiskLevel !== newDrsScore?.manualRiskLevel ||
      type === 'MANUAL' ||
      oldDrsScore.isUpdatable !== newDrsScore?.isUpdatable
    ) {
      await this.createAuditLog({
        logAction: oldDrsScore ? 'UPDATE' : 'CREATE',
        oldImage: oldDrsScore ?? {},
        newImage: newDrsScore ?? {},
        logMetadata: {
          userId: newDrsScore?.userId,
          type,
          transactionId: newDrsScore?.transactionId,
          createdAt: newDrsScore?.createdAt,
        },
        instanceId: newDrsScore?.userId,
        subtype: 'DRS_RISK_LEVEL',
      })
    }
  }

  public async handleParameterRiskItemUpdate(
    oldParameterRiskItemValue: ParameterAttributeRiskValues | null,
    newParameterRiskItemValue: ParameterAttributeRiskValues
  ) {
    const logAction = oldParameterRiskItemValue ? 'UPDATE' : 'CREATE'
    await this.createAuditLog({
      logAction,
      oldImage: oldParameterRiskItemValue ?? {},
      newImage: newParameterRiskItemValue ?? {},
      logMetadata: {
        parameter: newParameterRiskItemValue.parameter,
        riskEntityType: newParameterRiskItemValue.riskEntityType,
        targetIterableParameter:
          newParameterRiskItemValue.targetIterableParameter,
      },
      subtype: 'PARAMETER_RISK_ITEM',
    })
  }

  private async createAuditLog(
    auditLogCreateRequest: AuditLogCreateRequest
  ): Promise<void> {
    const { instanceId, logAction, oldImage, newImage, logMetadata, subtype } =
      auditLogCreateRequest

    const auditLog: AuditLog = {
      entityId: instanceId,
      action: logAction,
      oldImage,
      newImage,
      type: 'RISK_SCORING',
      logMetadata,
      subtype,
    }

    await publishAuditLog(this.tenantId, auditLog)
  }
}
