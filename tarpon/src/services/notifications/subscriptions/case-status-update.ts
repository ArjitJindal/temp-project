import {
  CaseStatusUpdatePayload,
  getStatusUpdateNotification,
} from './utils/status-update'
import { Subscriptions } from '.'
import { NotificationType } from '@/@types/openapi-internal/NotificationType'

export class CaseStatusUpdate extends Subscriptions {
  type: NotificationType = 'CASE_STATUS_UPDATE'

  async getNotification(payload: CaseStatusUpdatePayload) {
    return getStatusUpdateNotification(payload, 'CASE')
  }

  async toSend(payload: CaseStatusUpdatePayload) {
    return (
      payload.action === 'UPDATE' &&
      payload.subtype === 'STATUS_CHANGE' &&
      payload.type === 'CASE'
    )
  }
}
