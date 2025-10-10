import { Subscriptions } from '.'
import { NotificationType } from '@/@types/openapi-internal/NotificationType'
import {
  NotificationRawPayload,
  PartialNotification,
} from '@/@types/notifications'
import { RiskFactorApproval } from '@/@types/openapi-internal/RiskFactorApproval'
import { FLAGRIGHT_SYSTEM_USER } from '@/utils/user'

type Payload = NotificationRawPayload<RiskFactorApproval>

export class RiskFactorsApproval extends Subscriptions {
  type: NotificationType = 'RISK_FACTORS_APPROVAL'

  async toSend(payload: Payload): Promise<boolean> {
    return (
      payload.type === 'RISK_FACTOR' &&
      payload.subtype === 'RISK_FACTOR_PROPOSAL' &&
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
      notificationType: 'RISK_FACTORS_APPROVAL',
      createdAt: Date.now(),
      entityId: payload.entityId,
      triggeredBy: payload.user?.id ?? FLAGRIGHT_SYSTEM_USER,
      entityType: 'CASE', // Using CASE as a fallback, will be overridden
      recievers: [], // Will be populated by the notifications service
      notificationData: {
        type: 'APPROVAL_REQUIRED',
        approval: {
          id: approval.riskFactor.id,
          comment: approval.comment,
          approvalStep: approval.approvalStep,
          workflowRef: approval.workflowRef,
          action: approval.action,
          riskFactorType: approval.riskFactor.type,
        },
      },
      metadata: {},
    }
  }
}
