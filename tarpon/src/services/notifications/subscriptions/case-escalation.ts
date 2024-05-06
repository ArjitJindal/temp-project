import { getEntityMetadata } from './utils/commonUtils'
import { Subscriptions } from '.'
import {
  NotificationRawPayload,
  PartialNotification,
} from '@/@types/notifications'
import {
  CaseUpdateAuditLogImage,
  CaseLogMetaDataType,
} from '@/@types/audit-log'
import { NotificationType } from '@/@types/openapi-internal/NotificationType'
import { FLAGRIGHT_SYSTEM_USER } from '@/services/alerts/repository'
import { EscalationNotification } from '@/@types/openapi-internal/EscalationNotification'

type Payload = NotificationRawPayload<
  CaseUpdateAuditLogImage,
  CaseLogMetaDataType
>

export class CaseEscalation extends Subscriptions {
  type: NotificationType = 'CASE_ESCALATION'

  async toSend(payload: Payload): Promise<boolean> {
    return payload.type === 'CASE' && payload.action === 'ESCALATE'
  }

  async getNotification(
    payload: Payload
  ): Promise<PartialNotification | undefined> {
    const reviewAssignments = payload.newImage?.reviewAssignments
    const caseStatus = payload.newImage?.caseStatus

    if (!reviewAssignments?.length || caseStatus !== 'ESCALATED') {
      return
    }

    const recievers = reviewAssignments.map(
      (assignment) => assignment.assigneeUserId
    )

    const notification: PartialNotification<EscalationNotification> = {
      createdAt: Date.now(),
      entityId: payload.entityId,
      entityType: 'CASE',
      notificationType: 'CASE_ESCALATION',
      recievers,
      triggeredBy: payload.user?.id || FLAGRIGHT_SYSTEM_USER,
      notificationData: {
        type: 'ESCALATION',
        reviewAssignments,
        status: caseStatus,
        reason: payload.newImage?.reason ?? [],
        childCaseId: payload.newImage?.alertCaseId,
      },
      metadata: getEntityMetadata('CASE', payload.logMetadata),
    }

    return notification
  }
}
