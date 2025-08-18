import { Subscriptions } from './index'
import { NotificationType } from '@/@types/openapi-internal/NotificationType'
import {
  NotificationRawPayload,
  PartialNotification,
} from '@/@types/notifications'
import { UserApproval } from '@/@types/openapi-internal/UserApproval'
import { FLAGRIGHT_SYSTEM_USER } from '@/utils/user'

type Payload = NotificationRawPayload<UserApproval>

export class UserChangesApproval extends Subscriptions {
  type: NotificationType = 'USER_CHANGES_APPROVAL'

  async toSend(payload: Payload): Promise<boolean> {
    return (
      payload.type === 'USER' &&
      payload.subtype === 'USER_CHANGE_PROPOSAL' &&
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
      notificationType: 'USER_CHANGES_APPROVAL',
      createdAt: Date.now(),
      entityId: payload.entityId,
      triggeredBy: payload.user?.id ?? FLAGRIGHT_SYSTEM_USER,
      entityType: 'USER', // Using USER as the entity type
      recievers: [], // Will be populated by the notifications service
      notificationData: {
        type: 'APPROVAL_REQUIRED',
        approval: {
          id: approval.id,
          comment: approval.comment,
          approvalStep: approval.approvalStep,
          workflowRef: approval.workflowRef,
          userId: approval.userId,
          proposedChanges: approval.proposedChanges,
        },
      },
      metadata: {},
    }
  }
}
