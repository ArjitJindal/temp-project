import {
  AlertStatusUpdatePayload,
  getStatusUpdateNotification,
} from './utils/status-update'
import { Subscriptions } from '.'
import { NotificationType } from '@/@types/openapi-internal/NotificationType'

export class AlertStatusUpdate extends Subscriptions {
  type: NotificationType = 'ALERT_STATUS_UPDATE'

  async getNotification(payload: AlertStatusUpdatePayload) {
    return getStatusUpdateNotification(payload, 'ALERT')
  }

  async toSend(payload: AlertStatusUpdatePayload) {
    return (
      payload.action === 'UPDATE' &&
      payload.subtype === 'STATUS_CHANGE' &&
      payload.type === 'ALERT'
    )
  }
}
