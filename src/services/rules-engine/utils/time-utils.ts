import { Dayjs } from '@/utils/dayjs'

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

export const TIME_WINDOW_SCHEMA = {
  type: 'object',
  title: 'Time Window',
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
} as const

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
