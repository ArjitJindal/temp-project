import _ from 'lodash'
import { CaseService } from './case-service'
import {
  AuditLog,
  AuditLogActionEnum,
  AuditLogSubtypeEnum,
} from '@/@types/openapi-internal/AuditLog'
import { CaseUpdateRequest } from '@/@types/openapi-internal/CaseUpdateRequest'
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
      if (updates.caseStatus === 'CLOSED') {
        await this.handleCaseUpdateAuditLog(caseId, 'UPDATE', updates)
      }
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
}
