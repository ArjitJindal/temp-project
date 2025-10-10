import { getTimeDiff, subtractTime } from '../time-utils'
import dayjs from '@/utils/dayjs'

describe('subtractTime', () => {
  it('should return the correct afterTimestamp for units = 0', () => {
    const result = dayjs(
      subtractTime(dayjs('2021-03-05'), {
        units: 0,
        granularity: 'day',
      })
    )
    expect(result.valueOf()).toBe(dayjs('2021-03-05').valueOf())
  })

  it('should return the correct afterTimestamp for units = 1', () => {
    const result = dayjs(
      subtractTime(dayjs('2021-03-05'), {
        units: 1,
        fiscalYear: {
          startMonth: 4,
          startDay: 1,
        },
        granularity: 'fiscal_year',
      })
    )

    expect(result.valueOf()).toBe(dayjs('2020-04-01').valueOf())
  })

  it('should return the correct afterTimestamp for units = 2', () => {
    const result = dayjs(
      subtractTime(dayjs('2021-04-05'), {
        units: 2,
        fiscalYear: {
          startMonth: 4,
          startDay: 1,
        },
        granularity: 'fiscal_year',
      })
    )

    expect(result.valueOf()).toBe(dayjs('2020-04-01').valueOf())
  })

  it('should return the correct afterTimestamp for units = 3', () => {
    const result = dayjs(
      subtractTime(dayjs('2021-04-05'), {
        units: 3,
        fiscalYear: {
          startMonth: 4,
          startDay: 1,
        },
        granularity: 'fiscal_year',
      })
    )

    expect(result.valueOf()).toBe(dayjs('2019-04-01').valueOf())
  })

  it('should return the correct afterTimestamp for units = 4', () => {
    const result = dayjs(
      subtractTime(dayjs('2021-04-05'), {
        units: 4,
        fiscalYear: {
          startMonth: 4,
          startDay: 1,
        },
        granularity: 'fiscal_year',
      })
    )

    expect(result.valueOf()).toBe(dayjs('2018-04-01').valueOf())
  })

  it('should return the correct afterTimestamp for units = 5', () => {
    const result = dayjs(
      subtractTime(dayjs('2021-04-05'), {
        units: 5,
        fiscalYear: {
          startMonth: 4,
          startDay: 1,
        },
        granularity: 'fiscal_year',
      })
    )

    expect(result.valueOf()).toBe(dayjs('2017-04-01').valueOf())
  })

  it('should return the correct afterTimestamp for different fiscal year start', () => {
    const result = dayjs(
      subtractTime(dayjs('2023-03-03'), {
        units: 1,
        fiscalYear: {
          startMonth: 4,
          startDay: 1,
        },
        granularity: 'fiscal_year',
      })
    )

    expect(result.valueOf()).toBe(dayjs('2022-04-01').valueOf())
  })

  it('should return the same transactionDate when units = 1 and transactionDate is on April 1st', () => {
    const result = dayjs(
      subtractTime(dayjs('2021-04-01'), {
        units: 1,
        fiscalYear: {
          startMonth: 4,
          startDay: 1,
        },
        granularity: 'fiscal_year',
      })
    )

    expect(result.valueOf()).toBe(dayjs('2021-04-01').valueOf())
  })
})

describe('getTimeDiff', () => {
  it('should return the correct difference in days', () => {
    expect(getTimeDiff(dayjs('2024-06-05'), dayjs('2024-06-01'), 'day')).toBe(4)
    expect(
      getTimeDiff(
        dayjs('2024-06-05').add(1, 'hour'),
        dayjs('2024-06-01'),
        'day'
      )
    ).toBe(4)
  })

  it('should return the correct difference in weeks', () => {
    expect(getTimeDiff(dayjs('2024-06-05'), dayjs('2024-05-22'), 'week')).toBe(
      2
    )
    expect(
      getTimeDiff(
        dayjs('2024-06-05').add(1, 'day'),
        dayjs('2024-05-22'),
        'week'
      )
    ).toBe(2.142857142857143)
  })

  it('should return the correct difference in months', () => {
    expect(getTimeDiff(dayjs('2024-06-05'), dayjs('2024-04-05'), 'month')).toBe(
      2
    )
    expect(getTimeDiff(dayjs('2024-06-05'), dayjs('2024-04-04'), 'month')).toBe(
      2.032258064516129
    )
  })

  it('should return the correct difference in years', () => {
    expect(getTimeDiff(dayjs('2024-06-05'), dayjs('2023-06-05'), 'year')).toBe(
      1
    )
    expect(getTimeDiff(dayjs('2024-06-05'), dayjs('2023-06-04'), 'year')).toBe(
      1.0026881720430108
    )
  })
})
