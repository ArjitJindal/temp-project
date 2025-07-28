import { Subscriptions } from '.'
import { NotificationType } from '@/@types/openapi-internal/NotificationType'
import {
  NotificationRawPayload,
  PartialNotification,
} from '@/@types/notifications'
import { RiskClassificationConfigApproval } from '@/@types/openapi-internal/RiskClassificationConfigApproval'
import { FLAGRIGHT_SYSTEM_USER } from '@/utils/user'

type Payload = NotificationRawPayload<RiskClassificationConfigApproval>

export class RiskClassificationApproval extends Subscriptions {
  type: NotificationType = 'RISK_CLASSIFICATION_APPROVAL'

  async toSend(payload: Payload): Promise<boolean> {
    return (
      payload.type === 'RISK_SCORING' &&
      payload.subtype === 'RISK_CLASSIFICATION_PROPOSAL' &&
      (payload.action === 'UPDATE' || payload.action === 'CREATE') &&
      payload.newImage?.approvalStatus === 'PENDING'
    )
  }

  async getNotification(
    payload: Payload
  ): Promise<PartialNotification | undefined> {
    const approval = payload.newImage
    if (!approval || !approval.workflowRef) {
      return
    }
    // This will be handled by the notifications service with database access
    return {
      notificationType: 'RISK_CLASSIFICATION_APPROVAL',
      createdAt: Date.now(),
      entityId: payload.entityId,
      triggeredBy: payload.user?.id ?? FLAGRIGHT_SYSTEM_USER,
      entityType: 'CASE', // Using CASE as a fallback, will be overridden
      recievers: [], // Will be populated by the notifications service
      notificationData: {
        type: 'APPROVAL_REQUIRED',
        approval: {
          id: approval.riskClassificationConfig.id,
          comment: approval.comment,
          approvalStep: approval.approvalStep,
          workflowRef: approval.workflowRef,
        },
      },
      metadata: {},
    }
  }
}
