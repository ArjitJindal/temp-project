import _ from 'lodash'
import { CaseService } from './case-service'
import {
  AuditLog,
  AuditLogSubtypeEnum,
} from '@/@types/openapi-internal/AuditLog'
import { CaseUpdateRequest } from '@/@types/openapi-internal/CaseUpdateRequest'
import { Alert } from '@/@types/openapi-internal/Alert'
import { publishAuditLog } from '@/services/audit-log'
import { Case } from '@/@types/openapi-internal/Case'
import { Comment } from '@/@types/openapi-internal/Comment'
import { AlertsService } from '@/services/alerts'
import { AuditLogActionEnum } from '@/@types/openapi-internal/AuditLogActionEnum'

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
  subtype?: AuditLogSubtypeEnum
}

export class CasesAlertsAuditLogService {
  caseService: CaseService
  alertsService: AlertsService
  tenantId: string

  constructor(
    caseService: CaseService,
    alertsService: AlertsService,
    tenantId: string
  ) {
    this.caseService = caseService
    this.tenantId = tenantId
    this.alertsService = alertsService
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
      const alertEntity = await this.alertsService.getAlert(alertId)
      const oldImage: { [key: string]: string } = {}
      for (const field in Object.keys(updates)) {
        const oldValue = _.get(alertEntity, field)
        if (oldValue) {
          oldImage[field] = oldValue
        }
      }
      await this.createAlertAuditLog({
        alertId: alertId,
        logAction: 'UPDATE',
        oldImage: oldImage,
        newImage: updates,
        alertDetails: alertEntity,
      })
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

  public async createAuditLog(auditLogCreateRequest: AuditLogCreateRequest) {
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

  public async createAlertAuditLog(
    auditLogCreateRequest: AlertAuditLogCreateRequest
  ) {
    const { alertId, logAction, oldImage, newImage, alertDetails, subtype } =
      auditLogCreateRequest
    const alertEntity =
      alertDetails ?? (await this.alertsService.getAlert(alertId))
    const auditLog: AuditLog = {
      type: 'ALERT',
      action: logAction,
      timestamp: Date.now(),
      subtype: subtype,
      entityId: alertId,
      oldImage: oldImage,
      newImage: newImage,
      logMetadata: {
        alertAssignment: alertEntity?.assignments,
        alertCreationTimestamp: alertEntity?.createdTimestamp,
        alertPriority: alertEntity?.priority,
      },
    }
    await publishAuditLog(this.tenantId, auditLog)
  }
}
