import { MongoClient } from 'mongodb'
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb'
import { ReportRepository } from '../sar/repositories/report-repository'
import { getLatestInvestigationTime } from './utils'
import {
  AuditLog,
  AuditLogSubtypeEnum,
} from '@/@types/openapi-internal/AuditLog'
import { Alert } from '@/@types/openapi-internal/Alert'
import { publishAuditLog } from '@/services/audit-log'
import { Case } from '@/@types/openapi-internal/Case'
import { AuditLogActionEnum } from '@/@types/openapi-internal/AuditLogActionEnum'
import { CaseStatusUpdate } from '@/@types/openapi-internal/CaseStatusUpdate'
import { AlertStatusUpdateRequest } from '@/@types/openapi-internal/AlertStatusUpdateRequest'
import { API_USER, AlertsRepository } from '@/services/alerts/repository'
import { CaseRepository } from '@/services/cases/repository'
import { traceable } from '@/core/xray'
import { ChecklistItemValue } from '@/@types/openapi-internal/ChecklistItemValue'
import { AlertQaStatusUpdateRequest } from '@/@types/openapi-internal/AlertQaStatusUpdateRequest'
import { Report } from '@/@types/openapi-internal/Report'
import {
  AlertUpdateAuditLogImage,
  AlertLogMetaDataType,
  AuditLogAssignmentsImage,
  CaseUpdateAuditLogImage,
  CaseLogMetaDataType,
  CommentAuditLogImage,
  SarUpdateAuditLogImage,
  SarLogMetaDataType,
} from '@/@types/audit-log'
import { Account } from '@/@types/openapi-internal/Account'

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

type SarAuditLogCreateRequest = {
  sarId: string
  logAction: AuditLogActionEnum
  oldImage?: any
  newImage?: any
  sarDetails?: Report | null
  subtype?: AuditLogSubtypeEnum
}

@traceable
export class CasesAlertsReportAuditLogService {
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

  public async handleAuditLogForCaseAssignment(
    caseId: string,
    oldAssignments: AuditLogAssignmentsImage,
    newAssignments: AuditLogAssignmentsImage
  ): Promise<void> {
    await this.createAuditLog({
      caseId,
      logAction: 'UPDATE',
      oldImage: oldAssignments,
      newImage: newAssignments,
      subtype: newAssignments.assignments ? 'ASSIGNMENT' : 'REVIEW_ASSIGNMENT',
    })
  }

  public async handleAuditLogForCaseUpdate(
    oldCases: Case[],
    updates: Partial<CaseStatusUpdate>
  ): Promise<void> {
    await Promise.all(
      oldCases.map(async (case_) => {
        await this.handleCaseUpdateAuditLog(
          case_,
          updates as CaseUpdateAuditLogImage
        )
      })
    )
  }

  public async handleAuditLogForCaseEscalation(
    caseId: string,
    data: CaseUpdateAuditLogImage,
    oldCase: Case
  ): Promise<void> {
    const caseRepo = new CaseRepository(this.tenantId, {
      mongoDb: this.mongoDb,
      dynamoDb: this.dynamoDb,
    })
    const caseEntity = await caseRepo.getCaseById(caseId)

    const oldImage: CaseUpdateAuditLogImage = {
      caseStatus: oldCase.caseStatus,
      reviewAssignments: oldCase.reviewAssignments,
      assignments: oldCase.assignments,
    }

    const { reason, updatedTransactions } = data
    const newImage: CaseUpdateAuditLogImage = {
      ...data,
      caseStatus: caseEntity?.caseStatus,
      reviewAssignments: caseEntity?.reviewAssignments,
      reason: reason,
      updatedTransactions: updatedTransactions,
      assignments: caseEntity?.assignments,
    }

    await this.createAuditLog({
      caseId,
      logAction: 'ESCALATE',
      oldImage: oldImage,
      newImage: newImage,
      subtype: 'STATUS_CHANGE',
      caseDetails: caseEntity,
    })
  }

  public async handleAuditLogForAlertAssignment(
    alertId: string,
    oldImage: AuditLogAssignmentsImage,
    newImage: AuditLogAssignmentsImage
  ): Promise<void> {
    const alertsRepository = new AlertsRepository(this.tenantId, {
      mongoDb: this.mongoDb,
      dynamoDb: this.dynamoDb,
    })

    const alertEntity = await alertsRepository.getAlertById(alertId)

    await this.createAlertAuditLog({
      alertId,
      logAction: 'UPDATE',
      oldImage: oldImage,
      newImage: newImage,
      alertDetails: alertEntity,
      subtype: newImage.assignments ? 'ASSIGNMENT' : 'REVIEW_ASSIGNMENT',
    })
  }

  public async handleAuditLogForAlertsUpdate(
    oldAlerts: Alert[],
    updates: AlertStatusUpdateRequest
  ): Promise<void> {
    const alertsRepository = new AlertsRepository(this.tenantId, {
      mongoDb: this.mongoDb,
      dynamoDb: this.dynamoDb,
    })

    await Promise.all(
      oldAlerts.map(async (oldAlert) => {
        const alertId = oldAlert.alertId as string
        const alertEntity = await alertsRepository.getAlertById(alertId)

        const oldImage: AlertUpdateAuditLogImage = {
          alertStatus: oldAlert.alertStatus,
          reviewAssignments: oldAlert.reviewAssignments,
          assignments: oldAlert.assignments,
        }

        const newImage: AlertUpdateAuditLogImage = {
          ...updates,
          alertStatus: updates.alertStatus,
          reviewAssignments: alertEntity?.reviewAssignments,
          assignments: alertEntity?.assignments,
        }

        await this.createAlertAuditLog({
          alertId: alertId,
          logAction: 'UPDATE',
          oldImage,
          newImage,
          alertDetails: alertEntity,
          subtype: 'STATUS_CHANGE',
        })
      })
    )
  }

  public async handleAuditLogForAlertsEscalation(
    alertIds: string[],
    data: AlertUpdateAuditLogImage,
    oldCase: Case
  ): Promise<void> {
    for (const alertId of alertIds) {
      const alertEntity = oldCase.alerts?.find(
        (alert) => alert.alertId === alertId
      )

      if (!alertEntity) {
        continue
      }

      const oldImage: AlertUpdateAuditLogImage = {
        alertStatus: alertEntity.alertStatus,
        reviewAssignments: alertEntity.reviewAssignments,
        assignments: alertEntity.assignments,
      }

      await this.createAlertAuditLog({
        alertId: alertId,
        logAction: 'ESCALATE',
        oldImage: oldImage,
        newImage: { ...data, alertStatus: 'ESCALATED' },
        alertDetails: alertEntity,
        subtype: 'STATUS_CHANGE',
      })
    }
  }

  public async handleAuditLogForChecklistUpdate(
    alertId: string,
    oldRuleChecklist: ChecklistItemValue[] | undefined,
    ruleChecklist: ChecklistItemValue[] | undefined
  ): Promise<void> {
    await this.createAlertAuditLog({
      alertId,
      logAction: 'UPDATE',
      subtype: 'CHECKLIST_ITEM_STATUS_CHANGE',
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
      subtype: 'CHECKLIST_QA_STATUS_CHANGE',
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

  public async handleAuditLogForCasesComments(
    caseId: string,
    comment: CommentAuditLogImage
  ): Promise<void> {
    await this.createAuditLog({
      caseId,
      logAction: 'CREATE',
      newImage: comment,
      subtype: 'COMMENT',
    })
  }

  public async handleAuditLogForAlertsComments(
    alertId: string,
    comment: CommentAuditLogImage
  ): Promise<void> {
    await this.createAlertAuditLog({
      alertId,
      logAction: 'CREATE',
      newImage: comment,
      subtype: 'COMMENT',
    })
  }

  public async handleAuditLogForCommentDelete(
    caseId: string,
    comment: CommentAuditLogImage
  ): Promise<void> {
    await this.createAuditLog({
      caseId,
      logAction: 'DELETE',
      subtype: 'COMMENT',
      oldImage: comment,
      newImage: {},
    })
  }

  public async handleAuditLogForAlertsCommentDelete(
    alertId: string,
    comment: CommentAuditLogImage
  ): Promise<void> {
    await this.createAlertAuditLog({
      alertId,
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
      newImage: { alerts: newAlerts },
      oldImage: { alerts: oldAlerts },
      subtype,
    })
  }

  public async handleAuditLogForNewCase(
    caseItem: Case | Partial<Case>,
    subtype: AuditLogSubtypeEnum = 'CREATION'
  ): Promise<void> {
    await this.createAuditLog({
      caseId: caseItem.caseId ?? '',
      logAction: 'CREATE',
      newImage: caseItem,
      subtype,
    })
  }

  public async handleAuditLogForNewAlert(
    alertItem: Alert | Partial<Alert>,
    subtype: AuditLogSubtypeEnum = 'CREATION'
  ): Promise<void> {
    await this.createAlertAuditLog({
      alertId: alertItem.alertId ?? '',
      logAction: 'CREATE',
      newImage: alertItem,
      subtype,
    })
  }

  private async handleCaseUpdateAuditLog(
    oldCase: Case,
    updates: CaseUpdateAuditLogImage
  ) {
    const caseRepository = new CaseRepository(this.tenantId, {
      mongoDb: this.mongoDb,
      dynamoDb: this.dynamoDb,
    })

    const caseId = oldCase.caseId as string

    const caseEntity = await caseRepository.getCaseById(caseId)

    const oldImage: CaseUpdateAuditLogImage = {
      caseStatus: oldCase.caseStatus,
      reviewAssignments: oldCase.reviewAssignments,
      assignments: oldCase.assignments,
    }

    let investigationTime: number | undefined
    if (updates.caseStatus === 'CLOSED') {
      investigationTime =
        getLatestInvestigationTime(caseEntity?.statusChanges) || undefined
    }

    const newImage: CaseUpdateAuditLogImage = {
      ...updates,
      caseStatus: caseEntity?.caseStatus,
      reviewAssignments: caseEntity?.reviewAssignments,
      investigationTime,
      assignments: caseEntity?.assignments,
    }

    await this.createAuditLog({
      caseId: caseId,
      logAction: 'UPDATE',
      oldImage: oldImage,
      newImage: newImage,
      caseDetails: caseEntity,
      subtype: 'STATUS_CHANGE',
    })
  }

  public async handleViewCase(caseId: string) {
    await this.createAuditLog({
      logAction: 'VIEW',
      caseId,
    })
  }

  public async handleAuditLogForNewSar(
    sarItem: Report | Partial<Report>,
    subtype: AuditLogSubtypeEnum = 'CREATION'
  ) {
    await this.createSarAuditLog({
      sarId: sarItem.id ?? '',
      logAction: 'CREATE',
      newImage: sarItem,
      subtype,
    })
  }

  public async handleSarUpdateAuditLog(
    sarItem: Report | Partial<Report>,
    oldUpdates: SarUpdateAuditLogImage,
    newUpdates: SarUpdateAuditLogImage
  ) {
    await this.createSarAuditLog({
      sarId: sarItem.id ?? '',
      logAction: 'UPDATE',
      oldImage: {
        ...oldUpdates,
      },
      newImage: {
        ...newUpdates,
      },
    })
  }

  public async handleSarDeleteAuditLog(sarIds: string[]) {
    await Promise.all(
      sarIds.map(async (sarId) => {
        await this.createSarAuditLog({
          sarId: sarId,
          logAction: 'DELETE',
        })
      })
    )
  }

  public async createAuditLog(auditLogCreateRequest: AuditLogCreateRequest) {
    const { caseId, logAction, oldImage, newImage, caseDetails, subtype } =
      auditLogCreateRequest

    const caseRepository = new CaseRepository(this.tenantId, {
      mongoDb: this.mongoDb,
      dynamoDb: this.dynamoDb,
    })

    const caseEntity = caseDetails ?? (await caseRepository.getCaseById(caseId))
    const auditLog: Omit<AuditLog, 'logMetadata'> & {
      logMetadata: CaseLogMetaDataType
    } = {
      type: 'CASE',
      action: logAction,
      timestamp: Date.now(),
      entityId: caseId,
      subtype: subtype,
      oldImage: oldImage,
      newImage: newImage,
      logMetadata: {
        caseAssignment: caseEntity?.assignments ?? [],
        caseCreationTimestamp: caseEntity?.createdTimestamp,
        casePriority: caseEntity?.priority,
        caseStatus: caseEntity?.caseStatus,
        reviewAssignments: caseEntity?.reviewAssignments ?? [],
      },
      ...(subtype?.startsWith('API')
        ? {
            user: {
              id: API_USER,
            } as Account,
          }
        : {}),
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

    const auditLog: Omit<AuditLog, 'logMetadata'> & {
      logMetadata: AlertLogMetaDataType
    } = {
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
        alertStatus: alertEntity?.alertStatus,
        caseId: alertEntity?.caseId,
      },
      ...(subtype?.startsWith('API')
        ? {
            user: {
              id: API_USER,
            } as Account,
          }
        : {}),
    }
    await publishAuditLog(this.tenantId, auditLog)
  }

  public async createSarAuditLog(
    auditLogCreateRequest: SarAuditLogCreateRequest
  ) {
    const { sarId, logAction, oldImage, newImage, subtype, sarDetails } =
      auditLogCreateRequest

    const reportRepository = new ReportRepository(
      this.tenantId,
      this.mongoDb,
      this.dynamoDb
    )

    const sarEntity = sarDetails ?? (await reportRepository.getReport(sarId))
    const auditLog: Omit<AuditLog, 'logMetadata'> & {
      logMetadata: SarLogMetaDataType
    } = {
      type: 'SAR',
      action: logAction,
      timestamp: Date.now(),
      entityId: sarId,
      subtype: subtype,
      oldImage: oldImage,
      newImage: newImage,
      logMetadata: {
        name: sarEntity?.name,
        description: sarEntity?.description,
        caseId: sarEntity?.caseId,
        reportTypeId: sarEntity?.reportTypeId,
        caseUserId: sarEntity?.caseUserId,
        createdById: sarEntity?.createdById,
        parameters: sarEntity?.parameters,
        comments: sarEntity?.comments,
        revisions: sarEntity?.revisions,
        attachments: sarEntity?.attachments,
        caseUser: sarEntity?.caseUser,
        sarCreationTimestamp: sarEntity?.createdAt,
      },
      ...(subtype?.startsWith('API')
        ? {
            user: {
              id: API_USER,
            } as Account,
          }
        : {}),
    }
    await publishAuditLog(this.tenantId, auditLog)
  }

  public async handleAuditLogForCaseUpdateViaApi(
    caseId: string,
    oldImage: Partial<Case>,
    newImage: Partial<Case>
  ): Promise<void> {
    await this.createAuditLog({
      caseId,
      logAction: 'UPDATE',
      oldImage,
      newImage,
      subtype: 'API_UPDATE',
    })
  }

  public async handleAuditLogForAlertUpdateViaApi(
    alertId: string,
    oldImage: Partial<Alert>,
    newImage: Partial<Alert>
  ): Promise<void> {
    await this.createAlertAuditLog({
      alertId,
      logAction: 'UPDATE',
      oldImage,
      newImage,
      subtype: 'API_UPDATE',
    })
  }
}
