import dayjs from '@/utils/dayjs'
import { ConsumerUserEvent } from '@/@types/openapi-public/ConsumerUserEvent'
import { BusinessUserEvent } from '@/@types/openapi-public/BusinessUserEvent'

export function getTestUserEvent(
  userEvent: Partial<ConsumerUserEvent> = {}
): ConsumerUserEvent {
  return {
    timestamp: dayjs().valueOf(),
    userId: 'user id',
    eventId: 'even id',
    eventDescription: 'event description',
    ...userEvent,
  }
}

export function getTestBusinessEvent(
  userEvent: Partial<BusinessUserEvent> = {}
): ConsumerUserEvent {
  return {
    timestamp: dayjs().valueOf(),
    userId: 'user id',
    eventId: 'even id',
    eventDescription: 'event description',
    ...userEvent,
  }
}
