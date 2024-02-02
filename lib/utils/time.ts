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
