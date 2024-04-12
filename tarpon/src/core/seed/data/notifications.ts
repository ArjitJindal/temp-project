import { memoize } from 'lodash'
import { sampleNotifications } from '../samplers/notifications'
import { Notification } from '@/@types/openapi-internal/Notification'

export const getNotifications: () => Notification[] = memoize(() => {
  return sampleNotifications()
})
