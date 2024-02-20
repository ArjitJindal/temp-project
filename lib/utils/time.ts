import dayjsLib from './dayjs'

export function getFiscalYearStart(
  timestamp: dayjsLib.Dayjs,
  fiscalYear: {
    startMonth: number
    startDay: number
  }
): dayjsLib.Dayjs {
  const { startMonth, startDay } = fiscalYear
  const fiscalYearStart =
    timestamp.month() < startMonth - 1
      ? timestamp
          .subtract(1, 'year')
          .startOf('year')
          .add(startMonth - 1, 'month')
          .add(startDay - 1, 'day')
      : timestamp
          .startOf('year')
          .add(startMonth - 1, 'month')
          .add(startDay - 1, 'day')

  return fiscalYearStart
}

export function getSecondsFromTimestamp(timestamp?: number) {
  if (!timestamp) return undefined
  const date = new Date(timestamp)
  const utcHours = date.getUTCHours()
  const utcMinutes = date.getUTCMinutes()
  return (utcHours * 60 + utcMinutes) * 60
}
