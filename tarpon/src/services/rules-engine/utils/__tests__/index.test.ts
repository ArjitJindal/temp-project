import { compileTemplate } from '../format-description'
import { subtractTime } from '../time-utils'
import dayjs from '@/utils/dayjs'

describe('Basic description formatting', () => {
  it('should build to original text if no variables used', () => {
    const template = 'sample template with no vars'
    const compiled = compileTemplate(template)
    expect(compiled({})).toEqual(template)
    expect(compiled({ a: 42 })).toEqual(template)
    expect(compiled({ a: 'some value' })).toEqual(template)
  })
  it('should properly replace simple vars', () => {
    const template = '{{ var1 }}'
    const compiled = compileTemplate(template)
    expect(compiled({ var1: 42 })).toEqual('42')
  })
  it('should fail if var is missing in parameters', () => {
    const template = '{{ var1 }}'
    const compiled = compileTemplate(template)
    expect(() => compiled({})).toThrow()
  })
  it('should properly handle spaces around statements', () => {
    expect(compileTemplate('{{var1}}')({ var1: 42 })).toEqual('42')
    expect(compileTemplate('{{var1 }}')({ var1: 42 })).toEqual('42')
    expect(compileTemplate('{{var1   }}')({ var1: 42 })).toEqual('42')
    expect(compileTemplate('{{ var1}}')({ var1: 42 })).toEqual('42')
    expect(compileTemplate('{{    var1}}')({ var1: 42 })).toEqual('42')
    expect(compileTemplate('{{ var1 }}')({ var1: 42 })).toEqual('42')
    expect(compileTemplate('{{    var1    }}')({ var1: 42 })).toEqual('42')
  })
  it('should properly replace nested vars', () => {
    const template = '{{ var1.f1 }}'
    const compiled = compileTemplate(template)
    expect(compiled({ var1: { f1: 42 } })).toEqual('42')
  })
})

describe('Description formatting helpers', () => {
  it('possessive', () => {
    const template = '{{ possessive name }}'
    const compiled = compileTemplate(template)
    expect(compiled({ name: 'Nikolai' })).toEqual('Nikolai’s')
  })
})

describe('subtractTime', () => {
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
