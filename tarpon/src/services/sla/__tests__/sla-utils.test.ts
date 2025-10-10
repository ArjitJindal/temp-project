import {
  matchPolicyStatusConditions,
  getElapsedTime,
  getSLAStatusFromElapsedTime,
  operatorCheck,
} from '../sla-utils'
import { CaseStatus } from '@/@types/openapi-internal/CaseStatus'
import {
  SLAPolicyConfiguration,
  SLAPolicyConfigurationWorkingDaysEnum,
} from '@/@types/openapi-internal/SLAPolicyConfiguration'

describe('sla-utils', () => {
  describe('matchPolicyStatusConditions', () => {
    it('should return false if the derived status is CLOSED', () => {
      const status: CaseStatus = 'CLOSED'
      const statusCount = 5
      const policyConfiguration: SLAPolicyConfiguration = {
        SLATime: {
          breachTime: { units: 2, granularity: 'hours' },
        },
        workingDays: ['MON'],
        statusDetails: {
          statuses: ['OPEN'],
          statusesCount: [{ status: 'OPEN', operator: 'EQ', count: 10 }],
        },
      }

      const result = matchPolicyStatusConditions(
        status,
        statusCount,
        policyConfiguration,

        {
          makerAccounts: [],
          reviewerAccounts: [],
        }
      )

      expect(result).toBe(false)
    })

    it('should return false if the derived status is not included in the statuses', () => {
      const status: CaseStatus = 'OPEN_IN_PROGRESS'
      const statusCount = 5
      const policyConfiguration: SLAPolicyConfiguration = {
        SLATime: {
          breachTime: { units: 2, granularity: 'hours' },
        },
        workingDays: ['MON'],
        statusDetails: {
          statuses: ['OPEN'],
          statusesCount: [{ status: 'OPEN', operator: 'EQ', count: 10 }],
        },
      }

      const result = matchPolicyStatusConditions(
        status,
        statusCount,
        policyConfiguration,
        {
          makerAccounts: [],
          reviewerAccounts: [],
        }
      )

      expect(result).toBe(false)
    })

    it('should return false if the configuredCountDetails operator check fails', () => {
      const status: CaseStatus = 'OPEN'
      const statusCount = 5
      const policyConfiguration: SLAPolicyConfiguration = {
        SLATime: {
          breachTime: { units: 2, granularity: 'hours' },
        },
        workingDays: ['MON'],
        statusDetails: {
          statuses: ['OPEN'],
          statusesCount: [{ status: 'OPEN', operator: 'GT', count: 10 }],
        },
      }

      const result = matchPolicyStatusConditions(
        status,
        statusCount,
        policyConfiguration,
        {
          makerAccounts: [],
          reviewerAccounts: [],
        }
      )

      expect(result).toBe(false)
    })

    it('should return true if all conditions pass', () => {
      const status: CaseStatus = 'OPEN'
      const statusCount = 10
      const policyConfiguration: SLAPolicyConfiguration = {
        SLATime: {
          breachTime: { units: 2, granularity: 'hours' },
        },
        workingDays: ['MON'],
        statusDetails: {
          statuses: ['OPEN'],
          statusesCount: [{ status: 'OPEN', operator: 'EQ', count: 10 }],
        },
      }

      const result = matchPolicyStatusConditions(
        status,
        statusCount,
        policyConfiguration,
        {
          makerAccounts: [],
          reviewerAccounts: [],
        }
      )

      expect(result).toBe(true)
    })
  })

  describe('getElapsedTime', () => {
    it('should return 0 if the start and end time are the same and not a working day', () => {
      const startTime = 1627833600000 // July 2, 2021 00:00:00 UTC (Friday)
      const endTime = 1627833600000 // July 2, 2021 00:00:00 UTC (Friday)
      const workingDays: SLAPolicyConfigurationWorkingDaysEnum[] = [
        'MON',
        'TUE',
        'WED',
        'THU',
        'FRI',
      ]

      const result = getElapsedTime(startTime, endTime, workingDays)

      expect(result).toBe(0)
    })

    it('should return the difference in milliseconds if the start and end time have 1 Day gap and a working day', () => {
      const startTime = new Date('2024-07-01').valueOf() // July 1, 2024 00:00:00 UTC (Monday)
      const endTime = new Date('2024-07-02T00:00:00Z').valueOf() // July 2, 2024 00:00:00 UTC (Tuesday)
      const workingDays: SLAPolicyConfigurationWorkingDaysEnum[] = [
        'MON',
        'TUE',
        'WED',
        'THU',
        'FRI',
      ]

      const result = getElapsedTime(startTime, endTime, workingDays)

      expect(result).toBe(86400000) // 24 hours in milliseconds
    })

    it('should return the difference in milliseconds if the start and end time are in the same day and a working day', () => {
      const startTime = new Date('2024-07-01').valueOf() // July 1, 2024 00:00:00 UTC (Monday)
      const endTime = new Date('2024-07-01T12:00:00Z').valueOf() // July 1, 2024 05:00:00 UTC (Monday)
      const workingDays: SLAPolicyConfigurationWorkingDaysEnum[] = [
        'MON',
        'TUE',
        'WED',
        'THU',
        'FRI',
      ]

      const result = getElapsedTime(startTime, endTime, workingDays)

      expect(result).toBe(43200000) // 12 hours in milliseconds
    })

    it('should return the difference 0 in milliseconds if the start and end time have 1 Day gap and a non-working day', () => {
      const startTime = new Date('2024-07-01').valueOf() // July 1, 2024 00:00:00 UTC (Monday)
      const endTime = new Date('2024-07-02T00:00:00Z').valueOf() // July 2, 2024 00:00:00 UTC (Tuesday)
      const workingDays: SLAPolicyConfigurationWorkingDaysEnum[] = [
        'TUE',
        'WED',
        'THU',
        'FRI',
      ]

      const result = getElapsedTime(startTime, endTime, workingDays)

      expect(result).toBe(0)
    })

    it('should return the total elapsed time in milliseconds excluding non-working days', () => {
      const startTime = new Date('2024-07-01').valueOf() // July 1, 2024 00:00:00 UTC (Monday)
      const endTime = new Date('2024-07-09').valueOf() // July 9, 2024 00:00:00 UTC (Tuesday
      const workingDays: SLAPolicyConfigurationWorkingDaysEnum[] = [
        'MON',
        'TUE',
        'WED',
        'THU',
        'FRI',
      ]

      const result = getElapsedTime(startTime, endTime, workingDays)

      expect(result).toBe(518400000) // 6 days in milliseconds
    })
  })

  describe('getSLAStatusFromElapsedTime', () => {
    it('should return "OK" if the elapsed time is less than the warning time', () => {
      const elapsedTime = 1000
      const slaPolicyConfiguration: SLAPolicyConfiguration = {
        workingDays: ['MON'],
        statusDetails: {
          statuses: ['OPEN'],
        },
        SLATime: {
          warningTime: { units: 1, granularity: 'hours' },
          breachTime: { units: 2, granularity: 'hours' },
        },
      }

      const result = getSLAStatusFromElapsedTime(
        elapsedTime,
        slaPolicyConfiguration
      )

      expect(result).toBe('OK')
    })

    it('should return "WARNING" if the elapsed time is equal to the warning time', () => {
      const elapsedTime = 3600000 // 1 hour in milliseconds
      const slaPolicyConfiguration: SLAPolicyConfiguration = {
        workingDays: ['MON'],
        statusDetails: {
          statuses: ['OPEN'],
        },
        SLATime: {
          warningTime: { units: 1, granularity: 'hours' },
          breachTime: { units: 2, granularity: 'hours' },
        },
      }

      const result = getSLAStatusFromElapsedTime(
        elapsedTime,
        slaPolicyConfiguration
      )

      expect(result).toBe('WARNING')
    })

    it('should return "BREACHED" if the elapsed time is greater than or equal to the breach time', () => {
      const elapsedTime = 7200000 // 2 hours in milliseconds
      const slaPolicyConfiguration: SLAPolicyConfiguration = {
        workingDays: ['MON'],
        statusDetails: {
          statuses: ['OPEN'],
        },
        SLATime: {
          warningTime: { units: 1, granularity: 'hours' },
          breachTime: { units: 2, granularity: 'hours' },
        },
      }

      const result = getSLAStatusFromElapsedTime(
        elapsedTime,
        slaPolicyConfiguration
      )

      expect(result).toBe('BREACHED')
    })

    it('should return "OK" if the warning time is not defined', () => {
      const elapsedTime = 3600000 // 1 hour in milliseconds
      const slaPolicyConfiguration: SLAPolicyConfiguration = {
        workingDays: ['MON'],
        statusDetails: {
          statuses: ['OPEN'],
        },
        SLATime: {
          breachTime: { units: 2, granularity: 'hours' },
        },
      }

      const result = getSLAStatusFromElapsedTime(
        elapsedTime,
        slaPolicyConfiguration
      )

      expect(result).toBe('OK')
    })
  })

  describe('operatorCheck', () => {
    it('should return true if the operator is "EQ" and lhs is equal to rhs', () => {
      const operator = 'EQ'
      const lhs = 5
      const rhs = 5

      const result = operatorCheck(operator, lhs, rhs)

      expect(result).toBe(true)
    })

    it('should return true if the operator is "NE" and lhs is not equal to rhs', () => {
      const operator = 'NE'
      const lhs = 5
      const rhs = 10

      const result = operatorCheck(operator, lhs, rhs)

      expect(result).toBe(true)
    })

    it('should return true if the operator is "GT" and lhs is greater than rhs', () => {
      const operator = 'GT'
      const lhs = 10
      const rhs = 5

      const result = operatorCheck(operator, lhs, rhs)

      expect(result).toBe(true)
    })

    it('should return true if the operator is "GTE" and lhs is greater than or equal to rhs', () => {
      const operator = 'GTE'
      const lhs = 10
      const rhs = 5

      const result = operatorCheck(operator, lhs, rhs)

      expect(result).toBe(true)
    })

    it('should return true if the operator is "LT" and lhs is less than rhs', () => {
      const operator = 'LT'
      const lhs = 5
      const rhs = 10

      const result = operatorCheck(operator, lhs, rhs)

      expect(result).toBe(true)
    })

    it('should return true if the operator is "LTE" and lhs is less than or equal to rhs', () => {
      const operator = 'LTE'
      const lhs = 5
      const rhs = 10

      const result = operatorCheck(operator, lhs, rhs)

      expect(result).toBe(true)
    })
  })
})
