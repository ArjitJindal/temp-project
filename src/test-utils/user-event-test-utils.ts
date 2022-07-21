import dayjs from '@/utils/dayjs'
import { UserEvent } from '@/@types/openapi-public/UserEvent'

export function getTestUserEvent(
  userEvent: Partial<UserEvent> = {}
): UserEvent {
  return {
    type: 'LOGGED_IN',
    timestamp: dayjs().valueOf(),
    userId: 'user id',
    eventId: 'even id',
    eventDescription: 'event description',
    ...userEvent,
  }
}
