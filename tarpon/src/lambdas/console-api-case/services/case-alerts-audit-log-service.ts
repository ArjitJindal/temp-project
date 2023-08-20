import _ from 'lodash'
import { MongoClient } from 'mongodb'
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb'
import {
  AuditLog,
  AuditLogSubtypeEnum,
} from '@/@types/openapi-internal/AuditLog'
import { Alert } from '@/@types/openapi-internal/Alert'
import { publishAuditLog } from '@/services/audit-log'
import { Case } from '@/@types/openapi-internal/Case'
import { Comment } from '@/@types/openapi-internal/Comment'
import { AuditLogActionEnum } from '@/@types/openapi-internal/AuditLogActionEnum'
import { CaseStatusUpdate } from '@/@types/openapi-internal/CaseStatusUpdate'
import { CasesAssignmentsUpdateRequest } from '@/@types/openapi-internal/CasesAssignmentsUpdateRequest'
import { AlertStatusUpdateRequest } from '@/@types/openapi-internal/AlertStatusUpdateRequest'
import { AlertsAssignmentsUpdateRequest } from '@/@types/openapi-internal/AlertsAssignmentsUpdateRequest'
import { AlertsReviewAssignmentsUpdateRequest } from '@/@types/openapi-internal/AlertsReviewAssignmentsUpdateRequest'
import { CasesReviewAssignmentsUpdateRequest } from '@/@types/openapi-internal/CasesReviewAssignmentsUpdateRequest'
import { AlertsRepository } from '@/services/rules-engine/repositories/alerts-repository'
import { CaseRepository } from '@/services/rules-engine/repositories/case-repository'
import { traceable } from '@/core/xray'

type AuditLogCreateRequest = {
  caseId: string
  logAction: AuditLogActionEnum
  oldImage?: any
  newImage?: any
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

@traceable
export class CasesAlertsAuditLogService {
  tenantId: string
  mongoDb: MongoClient
  dynamoDb: DynamoDBDocumentClient

  constructor(
    tenantId: string,
    connections: {
      mongoDb: MongoClient
      dynamoDb: DynamoDBDocumentClient
    }
  ) {
    this.tenantId = tenantId
    this.mongoDb = connections.mongoDb as MongoClient
    this.dynamoDb = connections.dynamoDb as DynamoDBDocumentClient
  }

  public async handleAuditLogForCaseUpdate(
    caseIds: string[],
    updates: Partial<
      CaseStatusUpdate &
        CasesAssignmentsUpdateRequest &
        CasesReviewAssignmentsUpdateRequest
    >
  ): Promise<void> {
    for (const caseId of caseIds) {
      await this.handleCaseUpdateAuditLog(caseId, 'UPDATE', updates)
    }
  }

  public async handleAuditLogForAlertsUpdate(
    alertIds: string[],
    updates: Partial<
      AlertStatusUpdateRequest &
        AlertsAssignmentsUpdateRequest &
        AlertsReviewAssignmentsUpdateRequest
    >
  ): Promise<void> {
    const alertsRepository = new AlertsRepository(this.tenantId, {
      mongoDb: this.mongoDb,
      dynamoDb: this.dynamoDb,
    })

    for (const alertId of alertIds) {
      const alertEntity = await alertsRepository.getAlertById(alertId)
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

  public async handleAuditLogForCommentDelete(
    caseId: string,
    comment: Comment
  ): Promise<void> {
    await this.createAuditLog({
      caseId,
      logAction: 'DELETE',
      subtype: 'COMMENT',
      oldImage: comment,
      newImage: {},
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
    updates: Partial<
      CaseStatusUpdate &
        CasesAssignmentsUpdateRequest &
        CasesReviewAssignmentsUpdateRequest
    >
  ) {
    const caseRepository = new CaseRepository(this.tenantId, {
      mongoDb: this.mongoDb,
      dynamoDb: this.dynamoDb,
    })

    const caseEntity = await caseRepository.getCaseById(caseId)

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

  public async handleViewCase(caseId: string) {
    await this.createAuditLog({
      logAction: 'VIEW',
      caseId,
    })
  }

  public async createAuditLog(auditLogCreateRequest: AuditLogCreateRequest) {
    const { caseId, logAction, oldImage, newImage, caseDetails, subtype } =
      auditLogCreateRequest

    const caseRepository = new CaseRepository(this.tenantId, {
      mongoDb: this.mongoDb,
      dynamoDb: this.dynamoDb,
    })

    const caseEntity = caseDetails ?? (await caseRepository.getCaseById(caseId))

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

    const alertsRepository = new AlertsRepository(this.tenantId, {
      mongoDb: this.mongoDb,
      dynamoDb: this.dynamoDb,
    })

    const alertEntity =
      alertDetails ?? (await alertsRepository.getAlertById(alertId))

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
