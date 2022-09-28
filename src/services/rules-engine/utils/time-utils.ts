import { Dayjs, duration } from '@/utils/dayjs'

export type TimeWindowGranularity =
  | 'second'
  | 'minute'
  | 'hour'
  | 'day'
  | 'week'
  | 'month'

export type TimeWindow = {
  units: number
  granularity: TimeWindowGranularity
  rollingBasis?: boolean
}

export const TIME_WINDOW_SCHEMA = (params: { title?: string } = {}) =>
  ({
    type: 'object',
    title: params.title ?? 'Time Window',
    properties: {
      units: { type: 'integer', title: 'Number of time unit' },
      granularity: {
        type: 'string',
        title: 'Time granularity',
        enum: ['second', 'minute', 'hour', 'day', 'week', 'month'],
      },
      rollingBasis: {
        type: 'boolean',
        title: 'Rolling basis',
        description:
          'When rolling basis is disabled, system starts the time period at 00:00 for day, week, month time granularities',
        nullable: true,
      },
    },
    required: ['units', 'granularity'],
  } as const)

export function toGranularity(
  timeWindow: TimeWindow,
  granularity: TimeWindowGranularity
): TimeWindow {
  if (timeWindow.granularity === granularity) {
    return timeWindow
  }
  return {
    granularity: granularity,
    units: duration(timeWindow.units, timeWindow.granularity).as(granularity),
  }
}

export function subtractTime(timeStamp: Dayjs, timeWindow: TimeWindow): number {
  let afterTimestamp = timeStamp
    .subtract(timeWindow.units, timeWindow.granularity)
    .valueOf()
  if (
    !timeWindow.rollingBasis &&
    (timeWindow.granularity === 'day' ||
      timeWindow.granularity === 'week' ||
      timeWindow.granularity === 'month')
  ) {
    afterTimestamp = timeStamp
      .startOf(timeWindow.granularity)
      .subtract(timeWindow.units - 1, timeWindow.granularity)
      .valueOf()
  }
  return afterTimestamp
}

export const PAYMENT_METHODS = [
  'ACH',
  'CARD',
  'IBAN',
  'SWIFT',
  'UPI',
  'WALLET',
  'MPESA',
]
