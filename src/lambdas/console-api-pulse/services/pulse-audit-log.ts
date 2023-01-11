import {
  AuditLog,
  AuditLogActionEnum,
  AuditLogSubtypeEnum,
} from '@/@types/openapi-internal/AuditLog'
import { DrsScore } from '@/@types/openapi-internal/DrsScore'
import { ParameterAttributeRiskValues } from '@/@types/openapi-internal/ParameterAttributeRiskValues'
import { RiskClassificationScore } from '@/@types/openapi-internal/RiskClassificationScore'
import { RiskParameterLevelKeyValue } from '@/@types/openapi-internal/RiskParameterLevelKeyValue'
import { publishAuditLog } from '@/services/audit-log'

type AuditLogCreateRequest = {
  instanceId?: string
  logAction: AuditLogActionEnum
  oldImage?: any
  newImage?: any
  logMetadata?: any
  subtype?: AuditLogSubtypeEnum
}

type RecursivePartial<T> = {
  [P in keyof T]?: RecursivePartial<T[P]>
}

export class PulseAuditLogService {
  tenantId: string

  constructor(tenantId: string) {
    this.tenantId = tenantId
  }

  private riskClassificationArrayToObj(
    riskClassificationScore: RiskClassificationScore[]
  ) {
    const riskClassificationObj: any = {}
    riskClassificationScore.forEach((riskClassification) => {
      riskClassificationObj[`${riskClassification.riskLevel}LowerBound`] =
        riskClassification.lowerBoundRiskScore
      riskClassificationObj[`${riskClassification.riskLevel}UpperBound`] =
        riskClassification.upperBoundRiskScore
    })
    return riskClassificationObj
  }

  public async handleAuditLogForRiskClassificationsUpdated(
    oldRiskClassificationScore: RiskClassificationScore[] | undefined,
    newRiskClassificationScore: RiskClassificationScore[] | undefined
  ): Promise<void> {
    await this.createAuditLog({
      logAction: 'UPDATE',
      oldImage: oldRiskClassificationScore
        ? this.riskClassificationArrayToObj(oldRiskClassificationScore)
        : {},
      newImage: newRiskClassificationScore
        ? this.riskClassificationArrayToObj(newRiskClassificationScore)
        : {},
      logMetadata: {
        riskClassificationScore: newRiskClassificationScore,
      },
      subtype: 'RISK_CLASSIFICATION',
    })
  }

  private getParameterRiskItemValueObj(
    parameterRiskItemValue: ParameterAttributeRiskValues
  ) {
    return {
      parameter: parameterRiskItemValue.parameter,
      isActive: parameterRiskItemValue.isActive,
      isDerived: parameterRiskItemValue.isDerived,
      riskEntityType: parameterRiskItemValue.riskEntityType,
      riskAssignmentValues:
        parameterRiskItemValue.riskLevelAssignmentValues.map(
          (
            riskAssignmentValue: RecursivePartial<RiskParameterLevelKeyValue>
          ) => {
            delete riskAssignmentValue?.parameterValue?.content?.kind

            return {
              riskLevel: riskAssignmentValue?.riskLevel,
              values: riskAssignmentValue?.parameterValue?.content,
            }
          }
        ),
    }
  }

  private getDrsScoreObj(drsScore: DrsScore) {
    return {
      drsScore: drsScore.drsScore,
      manualRiskLevel: drsScore.manualRiskLevel,
      isUpdatable: drsScore.isUpdatable,
      transactionId: drsScore.transactionId,
      userId: drsScore.userId,
    }
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
      this.createAuditLog({
        logAction: oldDrsScore ? 'UPDATE' : 'CREATE',
        oldImage: oldDrsScore ? this.getDrsScoreObj(oldDrsScore) : {},
        newImage: newDrsScore ? this.getDrsScoreObj(newDrsScore) : {},
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
      oldImage: oldParameterRiskItemValue
        ? this.getParameterRiskItemValueObj(oldParameterRiskItemValue)
        : {},
      newImage: this.getParameterRiskItemValueObj(newParameterRiskItemValue),
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
      type: 'PULSE',
      logMetadata,
      subtype,
    }

    await publishAuditLog(this.tenantId, auditLog)
  }
}
