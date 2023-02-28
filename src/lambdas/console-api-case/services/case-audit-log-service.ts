import _ from 'lodash'
import { CaseService } from './case-service'
import {
  AuditLog,
  AuditLogActionEnum,
  AuditLogSubtypeEnum,
} from '@/@types/openapi-internal/AuditLog'
import { CaseUpdateRequest } from '@/@types/openapi-internal/CaseUpdateRequest'
import { Alert } from '@/@types/openapi-internal/Alert'
import { AlertUpdateRequest } from '@/@types/openapi-internal/AlertUpdateRequest'
import { publishAuditLog } from '@/services/audit-log'
import { Case } from '@/@types/openapi-internal/Case'
import { Comment } from '@/@types/openapi-internal/Comment'

type AuditLogCreateRequest = {
  caseId: string
  logAction: AuditLogActionEnum
  oldImage?: any
  newImage: any
  caseDetails?: Case | null
  subtype?: AuditLogSubtypeEnum
}

type AlertAuditLogCreateRequest = {
  alertId: string
  logAction: AuditLogActionEnum
  oldImage?: any
  newImage: any
  alertDetails?: Alert | null
}

export class CaseAuditLogService {
  caseService: CaseService
  tenantId: string

  constructor(caseService: CaseService, tenantId: string) {
    this.caseService = caseService
    this.tenantId = tenantId
  }

  public async handleAuditLogForCaseUpdate(
    caseIds: string[],
    updates: CaseUpdateRequest
  ): Promise<void> {
    for (const caseId of caseIds) {
      await this.handleCaseUpdateAuditLog(caseId, 'UPDATE', updates)
    }
  }

  public async handleAuditLogForAlertsUpdate(
    alertIds: string[],
    updates: CaseUpdateRequest
  ): Promise<void> {
    for (const alertId of alertIds) {
      await this.handleAlertUpdateAuditLog(alertId, 'UPDATE', updates)
    }
  }

  public async handleAuditLogForComments(
    caseId: string,
    comment: Comment
  ): Promise<void> {
    await this.createAuditLog({
      caseId,
      logAction: 'CREATE',
      newImage: comment,
      subtype: 'COMMENT',
    })
  }

  public async handleAuditLogForAlerts(
    caseId: string,
    oldAlerts: Alert[] | undefined,
    newAlerts: Alert[] | undefined
  ): Promise<void> {
    await this.createAuditLog({
      caseId,
      logAction: 'UPDATE',
      newImage: {
        alerts: newAlerts,
      },
      oldImage: {
        alerts: oldAlerts,
      },
    })
  }

  public async handleAuditLogForNewCase(caseItem: Case): Promise<void> {
    await this.createAuditLog({
      caseId: caseItem.caseId ?? '',
      logAction: 'CREATE',
      newImage: caseItem,
    })
  }

  private async handleCaseUpdateAuditLog(
    caseId: string,
    logAction: AuditLogActionEnum,
    updates: CaseUpdateRequest
  ) {
    const caseEntity = await this.caseService.getCase(caseId)
    const oldImage: { [key: string]: string } = {}
    for (const field in Object.keys(updates)) {
      const oldValue = _.get(caseEntity, field)
      if (oldValue) {
        oldImage[field] = oldValue
      }
    }
    await this.createAuditLog({
      caseId: caseId,
      logAction: logAction,
      oldImage: oldImage,
      newImage: updates,
      caseDetails: caseEntity,
    })
  }

  private async handleAlertUpdateAuditLog(
    alertId: string,
    logAction: AuditLogActionEnum,
    updates: AlertUpdateRequest
  ) {
    const alertEntity = await this.caseService.getAlert(alertId)
    const oldImage: { [key: string]: string } = {}
    for (const field in Object.keys(updates)) {
      const oldValue = _.get(alertEntity, field)
      if (oldValue) {
        oldImage[field] = oldValue
      }
    }
    await this.createAlertAuditLog({
      alertId: alertId,
      logAction: logAction,
      oldImage: oldImage,
      newImage: updates,
      alertDetails: alertEntity,
    })
  }

  private async createAuditLog(auditLogCreateRequest: AuditLogCreateRequest) {
    const { caseId, logAction, oldImage, newImage, caseDetails, subtype } =
      auditLogCreateRequest
    const caseEntity = caseDetails ?? (await this.caseService.getCase(caseId))
    const auditLog: AuditLog = {
      type: 'CASE',
      action: logAction,
      timestamp: Date.now(),
      entityId: caseId,
      subtype: subtype,
      oldImage: oldImage,
      newImage: newImage,
      logMetadata: {
        caseAssignment: caseEntity?.assignments,
        caseCreationTimestamp: caseEntity?.createdTimestamp,
        casePriority: caseEntity?.priority,
      },
    }
    await publishAuditLog(this.tenantId, auditLog)
  }

  private async createAlertAuditLog(
    auditLogCreateRequest: AlertAuditLogCreateRequest
  ) {
    const { alertId, logAction, oldImage, newImage, alertDetails } =
      auditLogCreateRequest
    const alertEntity =
      alertDetails ?? (await this.caseService.getAlert(alertId))
    const auditLog: AuditLog = {
      type: 'ALERT',
      action: logAction,
      timestamp: Date.now(),
      entityId: alertId,
      oldImage: oldImage,
      newImage: newImage,
      logMetadata: {
        caseAssignment: alertEntity?.assignments,
        caseCreationTimestamp: alertEntity?.createdTimestamp,
        casePriority: alertEntity?.priority,
      },
    }
    await publishAuditLog(this.tenantId, auditLog)
  }
}
