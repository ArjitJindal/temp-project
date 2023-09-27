import { MongoClient } from 'mongodb'
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb'
import { get } from 'lodash'
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
import { ChecklistItemValue } from '@/@types/openapi-internal/ChecklistItemValue'
import { AlertQaStatusUpdateRequest } from '@/@types/openapi-internal/AlertQaStatusUpdateRequest'

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
    >,
    subtype?: AuditLogSubtypeEnum
  ): Promise<void> {
    await Promise.all(
      caseIds.map(async (caseId) => {
        await this.handleCaseUpdateAuditLog(caseId, 'UPDATE', updates, subtype)
      })
    )
  }

  public async handleAuditLogForCaseEscalation(
    caseIds: string[],
    updates: Partial<CaseStatusUpdate>,
    subtype?: AuditLogSubtypeEnum
  ): Promise<void> {
    await Promise.all(
      caseIds.map(async (caseId) => {
        await this.handleCaseUpdateAuditLog(
          caseId,
          'ESCALATE',
          updates,
          subtype
        )
      })
    )
  }

  public async handleAuditLogForAlertsUpdate(
    alertIds: string[],
    updates: Partial<
      AlertStatusUpdateRequest &
        AlertsAssignmentsUpdateRequest &
        AlertsReviewAssignmentsUpdateRequest
    >,
    subtype?: AuditLogSubtypeEnum
  ): Promise<void> {
    const alertsRepository = new AlertsRepository(this.tenantId, {
      mongoDb: this.mongoDb,
      dynamoDb: this.dynamoDb,
    })

    for (const alertId of alertIds) {
      const alertEntity = await alertsRepository.getAlertById(alertId)
      const oldImage: { [key: string]: string } = {}
      for (const field in Object.keys(updates)) {
        const oldValue = get(alertEntity, field)
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
        subtype,
      })
    }
  }

  public async handleAuditLogForAlertsEscalation(
    alertIds: string[],
    updates: Partial<AlertStatusUpdateRequest>,
    subtype?: AuditLogSubtypeEnum
  ): Promise<void> {
    const alertsRepository = new AlertsRepository(this.tenantId, {
      mongoDb: this.mongoDb,
      dynamoDb: this.dynamoDb,
    })

    for (const alertId of alertIds) {
      const alertEntity = await alertsRepository.getAlertById(alertId)
      const oldImage: { [key: string]: string } = {}
      for (const field in Object.keys(updates)) {
        const oldValue = get(alertEntity, field)
        if (oldValue) {
          oldImage[field] = oldValue
        }
      }
      await this.createAlertAuditLog({
        alertId: alertId,
        logAction: 'ESCALATE',
        oldImage: oldImage,
        newImage: updates,
        alertDetails: alertEntity,
        subtype,
      })
    }
  }

  public async handleAuditLogForAlertChecklistUpdate(
    alertId: string,
    oldRuleChecklist: ChecklistItemValue[] | undefined,
    ruleChecklist: ChecklistItemValue[] | undefined
  ): Promise<void> {
    await this.createAlertAuditLog({
      alertId,
      logAction: 'UPDATE',
      subtype: 'CHECKLIST',
      oldImage: { ruleChecklist: oldRuleChecklist },
      newImage: { ruleChecklist: ruleChecklist },
    })
  }

  public async handleAuditLogForAlertQaUpdate(
    alertId: string,
    update: AlertQaStatusUpdateRequest
  ): Promise<void> {
    await this.createAlertAuditLog({
      alertId,
      logAction: 'UPDATE',
      subtype: 'CHECKLIST',
      newImage: {
        qaStatus: update.checklistStatus,
        qaInfo: {
          reason: update.reason,
          comment: update.comment,
          files: update.files,
        },
      },
    })
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
    newAlerts: Alert[] | undefined,
    subtype?: AuditLogSubtypeEnum
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
      subtype,
    })
  }

  public async handleAuditLogForNewCase(
    caseItem: Case | Partial<Case>
  ): Promise<void> {
    await this.createAuditLog({
      caseId: caseItem.caseId ?? '',
      logAction: 'CREATE',
      newImage: caseItem,
      subtype: 'CREATION',
    })
  }

  public async handleAuditLogForNewAlert(
    alertItem: Alert | Partial<Alert>
  ): Promise<void> {
    await this.createAlertAuditLog({
      alertId: alertItem.alertId ?? '',
      logAction: 'CREATE',
      newImage: alertItem,
      subtype: 'CREATION',
    })
  }

  private async handleCaseUpdateAuditLog(
    caseId: string,
    logAction: AuditLogActionEnum,
    updates: Partial<
      CaseStatusUpdate &
        CasesAssignmentsUpdateRequest &
        CasesReviewAssignmentsUpdateRequest
    >,
    subtype?: AuditLogSubtypeEnum
  ) {
    const caseRepository = new CaseRepository(this.tenantId, {
      mongoDb: this.mongoDb,
      dynamoDb: this.dynamoDb,
    })

    const caseEntity = await caseRepository.getCaseById(caseId)

    const oldImage: { [key: string]: string } = {}
    for (const field in Object.keys(updates)) {
      const oldValue = get(caseEntity, field)
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
      subtype,
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
