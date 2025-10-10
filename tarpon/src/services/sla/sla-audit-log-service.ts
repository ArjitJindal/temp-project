import { AuditLog } from '@/@types/openapi-internal/AuditLog'
import { publishAuditLog } from '@/services/audit-log'
import { AuditLogActionEnum } from '@/@types/openapi-internal/AuditLogActionEnum'
import { SLAPolicy } from '@/@types/openapi-internal/SLAPolicy'
import { traceable } from '@/core/xray'
import { SLAPolicyStatus } from '@/@types/openapi-internal/SLAPolicyStatus'
import { getContext } from '@/core/utils/context-storage'
import { Account } from '@/@types/openapi-internal/Account'
import { FLAGRIGHT_SYSTEM_USER } from '@/utils/user'

type SLAAuditLogCreateRequest = {
  entityId: string
  logAction: AuditLogActionEnum
  oldImage?: any
  newImage?: any
  slaDetails?: {
    policyId: string
    elapsedTime?: number
    policyStatus?: SLAPolicyStatus
  }
  subtype?: 'SLA_STATUS_UPDATE' | 'SLA_POLICY_UPDATE'
  user?: Account
}

@traceable
export class SLAAuditLogService {
  tenantId: string

  constructor(tenantId: string) {
    this.tenantId = tenantId
  }

  public async handleAuditLogForSLAStatusChange(
    entityId: string,
    oldStatus: SLAPolicyStatus | undefined,
    newStatus: SLAPolicyStatus,
    policyId: string,
    elapsedTime: number
  ): Promise<void> {
    await this.createAuditLog({
      entityId,
      logAction: 'UPDATE',
      oldImage: oldStatus ? { status: oldStatus } : undefined,
      newImage: { status: newStatus },
      slaDetails: {
        policyId,
        elapsedTime,
        policyStatus: newStatus,
      },
      subtype: 'SLA_STATUS_UPDATE',
      user: { id: FLAGRIGHT_SYSTEM_USER, role: 'root' } as Account,
    })
  }

  public async handleAuditLogForSLAPolicyChange(
    policyId: string,
    oldPolicy: SLAPolicy | undefined | null,
    newPolicy: SLAPolicy
  ): Promise<void> {
    await this.createAuditLog({
      entityId: policyId,
      logAction: oldPolicy ? 'UPDATE' : 'CREATE',
      oldImage: oldPolicy,
      newImage: newPolicy,
      slaDetails: {
        policyId,
      },
      subtype: 'SLA_POLICY_UPDATE',
      user: getContext()?.user as Account,
    })
  }

  private async createAuditLog(request: SLAAuditLogCreateRequest) {
    const {
      entityId,
      logAction,
      oldImage,
      newImage,
      slaDetails,
      subtype,
      user,
    } = request

    const auditLog: AuditLog = {
      type: 'SLA',
      action: logAction,
      timestamp: Date.now(),
      entityId,
      subtype,
      user,
      oldImage,
      newImage,
      logMetadata: {
        policyId: slaDetails?.policyId,
        elapsedTime: slaDetails?.elapsedTime,
        policyStatus: slaDetails?.policyStatus,
      },
    }

    await publishAuditLog(this.tenantId, auditLog)
  }
}
