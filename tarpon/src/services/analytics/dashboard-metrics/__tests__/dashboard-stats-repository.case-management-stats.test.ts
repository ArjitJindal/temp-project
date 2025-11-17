import { getCaseRepo, getStatsRepo } from './helpers'
import dayjs from '@/utils/dayjs'
import { dynamoDbSetupHook } from '@/test-utils/dynamodb-test-utils'
import { getTestTenantId } from '@/test-utils/tenant-test-utils'
import { Alert } from '@/@types/openapi-internal/Alert'
import { DEFAULT_CASE_AGGREGATES } from '@/constants/case-creation'
import { withFeaturesToggled } from '@/test-utils/feature-test-utils'

dynamoDbSetupHook()

type EntityType = 'CASE' | 'ALERT' | undefined

withFeaturesToggled([], ['CLICKHOUSE_ENABLED'], () => {
  describe('Verify case and alerts closing reason stats', () => {
    test(`Check for cases`, async () => {
      const TENANT_ID = getTestTenantId()
      const caseRepository = await getCaseRepo(TENANT_ID)
      const statsRepository = await getStatsRepo(TENANT_ID)

      const timestamp = dayjs('2022-01-30T12:00:00.000Z').valueOf()

      const userId = 'test-user-id'

      await caseRepository.addCaseMongo({
        caseId: 'C-1',
        createdTimestamp: timestamp,
        caseType: 'SYSTEM',
        caseStatus: 'OPEN',
        caseAggregates: DEFAULT_CASE_AGGREGATES,
      })
      await caseRepository.addCaseMongo({
        caseType: 'SYSTEM',
        caseId: 'C-2',
        createdTimestamp: timestamp,
        caseStatus: 'CLOSED',
        lastStatusChange: {
          reason: ['Other', 'Documents collected', 'Escalated'],
          userId,
          timestamp,
        },
        caseAggregates: DEFAULT_CASE_AGGREGATES,
      })
      await caseRepository.addCaseMongo({
        caseId: 'C-3',
        caseType: 'SYSTEM',
        createdTimestamp: timestamp,
        caseStatus: 'ESCALATED',
        lastStatusChange: {
          reason: ['Other'],
          userId,
          timestamp,
        },
        caseAggregates: DEFAULT_CASE_AGGREGATES,
      })
      await caseRepository.addCaseMongo({
        caseId: 'C-4',
        caseType: 'SYSTEM',
        createdTimestamp: timestamp,
        caseStatus: 'CLOSED',
        lastStatusChange: {
          reason: ['Other', 'Documents collected', 'False positive'],
          userId,
          timestamp,
        },
        caseAggregates: DEFAULT_CASE_AGGREGATES,
      })
      const entityType: EntityType = 'CASE'
      const stats =
        await statsRepository.getClosingReasonDistributionStatistics(entityType)
      expect(stats).toEqual({
        closingReasonsData: [
          {
            reason: 'Documents collected',
            value: 2,
          },
          {
            reason: 'Escalated',
            value: 1,
          },
          {
            reason: 'False positive',
            value: 1,
          },
          {
            reason: 'Other',
            value: 2,
          },
        ],
      })
    })

    test(`Check for alerts`, async () => {
      const TENANT_ID = getTestTenantId()
      const caseRepository = await getCaseRepo(TENANT_ID)
      const statsRepository = await getStatsRepo(TENANT_ID)

      const timestamp = dayjs('2022-01-30T12:00:00.000Z').valueOf()

      const userId = 'test-user-id'

      const alert: Alert = {
        alertId: 'A-0',
        ruleName: 'test-rule-1',
        ruleDescription: '',
        ruleId: 'R-1',
        ruleAction: 'ALLOW',
        numberOfTransactionsHit: 10,
        priority: 'P1',
        createdTimestamp: timestamp,
        ruleInstanceId: 'test-rule-id-1',
      }

      await caseRepository.addCaseMongo({
        caseId: 'C-1',
        createdTimestamp: timestamp,
        caseType: 'SYSTEM',
        caseStatus: 'OPEN',
        caseAggregates: DEFAULT_CASE_AGGREGATES,
      })
      await caseRepository.addCaseMongo({
        caseType: 'SYSTEM',
        caseId: 'C-2',
        createdTimestamp: timestamp,
        caseStatus: 'CLOSED',
        lastStatusChange: {
          reason: ['Anti-money laundering', 'Documents collected', 'Escalated'],
          userId,
          timestamp,
        },
        alerts: [
          {
            ...alert,
            alertId: 'A-1',
            alertStatus: 'CLOSED',
            priority: 'P2',
            lastStatusChange: {
              reason: ['Other'],
              userId,
              timestamp,
            },
          },
          {
            ...alert,
            alertId: 'A-2',
            alertStatus: 'CLOSED',
            priority: 'P3',
            lastStatusChange: {
              reason: ['Documents collected'],
              userId,
              timestamp,
            },
          },
          {
            ...alert,
            alertId: 'A-3',
            alertStatus: 'CLOSED',
            priority: 'P4',
            lastStatusChange: {
              reason: ['Documents not collected', 'False positive'],
              userId,
              timestamp,
            },
          },
        ],
        caseAggregates: DEFAULT_CASE_AGGREGATES,
      })
      await caseRepository.addCaseMongo({
        caseId: 'C-3',
        caseType: 'SYSTEM',
        createdTimestamp: timestamp,
        caseStatus: 'ESCALATED',
        lastStatusChange: {
          reason: ['Other'],
          userId,
          timestamp,
        },
        alerts: [
          {
            ...alert,
            alertId: 'A-4',
            alertStatus: 'ESCALATED',
            priority: 'P1',
          },
        ],
        caseAggregates: DEFAULT_CASE_AGGREGATES,
      })
      await caseRepository.addCaseMongo({
        caseId: 'C-4',
        caseType: 'SYSTEM',
        createdTimestamp: timestamp,
        caseStatus: 'CLOSED',
        lastStatusChange: {
          reason: [
            'Anti-money laundering',
            'Documents collected',
            'False positive',
          ],
          userId,
          timestamp,
        },
        alerts: [
          {
            ...alert,
            alertId: 'A-10',
            alertStatus: 'CLOSED',
            priority: 'P3',
            lastStatusChange: {
              reason: [
                'Other',
                'Investigation completed',
                'Suspicious activity reported (SAR)',
              ],
              userId,
              timestamp,
            },
          },
          {
            ...alert,
            alertId: 'A-11',
            alertStatus: 'CLOSED',
            priority: 'P4',
            lastStatusChange: {
              reason: [
                'Documents collected',
                'Suspicious activity reported (SAR)',
              ],
              userId,
              timestamp,
            },
          },
          {
            ...alert,
            alertId: 'A-12',
            alertStatus: 'CLOSED',
            priority: 'P1',
            lastStatusChange: {
              reason: [
                'Documents not collected',
                'False positive',
                'Suspicious activity reported (SAR)',
              ],
              userId,
              timestamp,
            },
          },
        ],
        caseAggregates: DEFAULT_CASE_AGGREGATES,
      })
      const entityType: EntityType = 'ALERT'
      const stats =
        await statsRepository.getClosingReasonDistributionStatistics(entityType)
      expect(stats).toEqual({
        closingReasonsData: [
          {
            reason: 'Documents collected',
            value: 2,
          },
          {
            reason: 'Documents not collected',
            value: 2,
          },
          {
            reason: 'False positive',
            value: 2,
          },
          {
            reason: 'Investigation completed',
            value: 1,
          },
          {
            reason: 'Other',
            value: 2,
          },
          {
            reason: 'Suspicious activity reported (SAR)',
            value: 3,
          },
        ],
      })
    })
  })
})

withFeaturesToggled([], ['CLICKHOUSE_ENABLED'], () => {
  describe('Status distribution stats', () => {
    test('Case status distribution stats', async () => {
      const TENANT_ID = getTestTenantId()
      const caseRepository = await getCaseRepo(TENANT_ID)
      const statsRepository = await getStatsRepo(TENANT_ID)
      const timestamp = dayjs('2024-01-30T12:00:00.000Z').valueOf()
      const userId = 'test-user-id'

      // Add test cases with different statuses
      await caseRepository.addCaseMongo({
        caseId: 'C-1',
        createdTimestamp: timestamp,
        caseType: 'SYSTEM',
        caseStatus: 'OPEN',
        caseAggregates: DEFAULT_CASE_AGGREGATES,
      })
      await caseRepository.addCaseMongo({
        caseType: 'SYSTEM',
        caseId: 'C-2',
        createdTimestamp: timestamp,
        caseStatus: 'OPEN_IN_PROGRESS',
        lastStatusChange: {
          reason: ['Other'],
          userId,
          timestamp,
        },
        caseAggregates: DEFAULT_CASE_AGGREGATES,
      })
      await caseRepository.addCaseMongo({
        caseId: 'C-3',
        caseType: 'SYSTEM',
        createdTimestamp: timestamp,
        caseStatus: 'ESCALATED',
        lastStatusChange: {
          reason: ['Other'],
          userId,
          timestamp,
        },
        caseAggregates: DEFAULT_CASE_AGGREGATES,
      })

      // Test case status distribution
      const startDate = dayjs('2024-01-01').valueOf()
      const endDate = dayjs('2024-12-31').valueOf()

      const caseStats =
        await statsRepository.getAlertAndCaseStatusDistributionStatistics(
          startDate,
          endDate,
          'MONTH',
          'CASE'
        )

      const expectedMonths = Array.from({ length: 12 }, (_, i) => {
        const date = dayjs('2024-01-01').add(i, 'month')
        return {
          _id: date.format('YYYY-MM'),
          count_OPEN: date.format('YYYY-MM') === '2024-01' ? 1 : 0,
          count_IN_PROGRESS: date.format('YYYY-MM') === '2024-01' ? 1 : 0,
          count_ON_HOLD: 0,
          count_ESCALATED: date.format('YYYY-MM') === '2024-01' ? 1 : 0,
          count_ESCALATED_L2: 0,
          count_CLOSED: 0,
          count_REOPENED: 0,
          count_IN_REVIEW: 0,
        }
      })
      expect(caseStats).toEqual({
        data: expectedMonths,
      })
    })

    test('Alert status distribution stats', async () => {
      const TENANT_ID = getTestTenantId()
      const caseRepository = await getCaseRepo(TENANT_ID)
      const statsRepository = await getStatsRepo(TENANT_ID)
      const timestamp = dayjs('2024-01-30T12:00:00.000Z').valueOf()
      const userId = 'test-user-id'

      const alert: Alert = {
        alertId: 'A-0',
        ruleName: 'test-rule-1',
        ruleDescription: '',
        ruleId: 'R-1',
        ruleAction: 'ALLOW',
        numberOfTransactionsHit: 10,
        priority: 'P1',
        createdTimestamp: timestamp,
        ruleInstanceId: 'test-rule-id-1',
      }

      await caseRepository.addCaseMongo({
        caseId: 'C-1',
        caseType: 'SYSTEM',
        createdTimestamp: timestamp,
        caseStatus: 'CLOSED',
        lastStatusChange: {
          reason: ['Other'],
          userId,
          timestamp,
        },
        alerts: [
          {
            ...alert,
            alertId: 'A-1',
            alertStatus: 'CLOSED',
            priority: 'P2',
            lastStatusChange: {
              reason: ['Other'],
              userId,
              timestamp,
            },
          },
          {
            ...alert,
            alertId: 'A-2',
            alertStatus: 'OPEN',
            priority: 'P3',
            lastStatusChange: {
              reason: ['Documents collected'],
              userId,
              timestamp,
            },
          },
          {
            ...alert,
            alertId: 'A-3',
            alertStatus: 'ESCALATED',
            priority: 'P4',
            lastStatusChange: {
              reason: ['Documents not collected', 'False positive'],
              userId,
              timestamp,
            },
          },
          {
            ...alert,
            alertId: 'A-4',
            alertStatus: 'OPEN_IN_PROGRESS',
            priority: 'P1',
            lastStatusChange: {
              reason: ['Documents collected'],
              userId,
              timestamp,
            },
          },
        ],
        caseAggregates: DEFAULT_CASE_AGGREGATES,
      })

      const startDate = dayjs('2023-01-01').valueOf()
      const endDate = dayjs('2024-12-31').valueOf()

      const alertStats =
        await statsRepository.getAlertAndCaseStatusDistributionStatistics(
          startDate,
          endDate,
          'MONTH',
          'ALERT'
        )

      const expectedMonths = Array.from({ length: 24 }, (_, i) => {
        const date = dayjs('2023-01-01').add(i, 'month')
        return {
          _id: date.format('YYYY-MM'),
          count_OPEN: date.format('YYYY-MM') === '2024-01' ? 1 : 0,
          count_IN_PROGRESS: date.format('YYYY-MM') === '2024-01' ? 1 : 0,
          count_ON_HOLD: 0,
          count_ESCALATED: date.format('YYYY-MM') === '2024-01' ? 1 : 0,
          count_ESCALATED_L2: 0,
          count_CLOSED: date.format('YYYY-MM') === '2024-01' ? 1 : 0,
          count_REOPENED: 0,
          count_IN_REVIEW: 0,
        }
      })

      expect(alertStats).toEqual({
        data: expectedMonths,
      })
    })
  })
})
withFeaturesToggled([], ['CLICKHOUSE_ENABLED'], () => {
  describe('Priority stats for alerts', () => {
    test(`Priority stats for alerts`, async () => {
      const TENANT_ID = getTestTenantId()
      const caseRepository = await getCaseRepo(TENANT_ID)
      const statsRepository = await getStatsRepo(TENANT_ID)
      const timestamp = dayjs('2022-01-30T12:00:00.000Z').valueOf()
      const userId = 'test-user-id'
      const alert: Alert = {
        alertId: 'A-0',
        ruleName: 'test-rule-1',
        ruleDescription: '',
        ruleId: 'R-1',
        ruleAction: 'ALLOW',
        numberOfTransactionsHit: 10,
        priority: 'P1',
        createdTimestamp: timestamp,
        ruleInstanceId: 'test-rule-id-1',
      }
      await caseRepository.addCaseMongo({
        caseId: 'C-1',
        createdTimestamp: timestamp,
        caseType: 'SYSTEM',
        caseStatus: 'OPEN',
        caseAggregates: DEFAULT_CASE_AGGREGATES,
      })
      await caseRepository.addCaseMongo({
        caseType: 'SYSTEM',
        caseId: 'C-2',
        createdTimestamp: timestamp,
        caseStatus: 'OPEN',
        lastStatusChange: {
          reason: ['Anti-money laundering', 'Documents collected', 'Escalated'],
          userId,
          timestamp,
        },
        alerts: [
          {
            ...alert,
            alertId: 'A-1',
            alertStatus: 'OPEN',
            priority: 'P2',
            lastStatusChange: {
              reason: ['Other'],
              userId,
              timestamp,
            },
          },
          {
            ...alert,
            alertId: 'A-2',
            alertStatus: 'OPEN',
            priority: 'P3',
            lastStatusChange: {
              reason: ['Documents collected'],
              userId,
              timestamp,
            },
          },
          {
            ...alert,
            alertId: 'A-3',
            alertStatus: 'REOPENED',
            priority: 'P4',
            lastStatusChange: {
              reason: ['Documents not collected', 'False positive'],
              userId,
              timestamp,
            },
          },
        ],
        caseAggregates: DEFAULT_CASE_AGGREGATES,
      })
      await caseRepository.addCaseMongo({
        caseId: 'C-3',
        caseType: 'SYSTEM',
        createdTimestamp: timestamp,
        caseStatus: 'ESCALATED',
        lastStatusChange: {
          reason: ['Other'],
          userId,
          timestamp,
        },
        alerts: [
          {
            ...alert,
            alertId: 'A-4',
            alertStatus: 'OPEN',
            priority: 'P1',
          },
        ],
        caseAggregates: DEFAULT_CASE_AGGREGATES,
      })
      await caseRepository.addCaseMongo({
        caseId: 'C-4',
        caseType: 'SYSTEM',
        createdTimestamp: timestamp,
        caseStatus: 'OPEN',
        lastStatusChange: {
          reason: [
            'Anti-money laundering',
            'Documents collected',
            'False positive',
          ],
          userId,
          timestamp,
        },
        alerts: [
          {
            ...alert,
            alertId: 'A-10',
            alertStatus: 'OPEN',
            priority: 'P3',
            lastStatusChange: {
              reason: [
                'Other',
                'Investigation completed',
                'Suspicious activity reported (SAR)',
              ],
              userId,
              timestamp,
            },
          },
          {
            ...alert,
            alertId: 'A-11',
            alertStatus: 'REOPENED',
            priority: 'P4',
            lastStatusChange: {
              reason: [
                'Documents collected',
                'Suspicious activity reported (SAR)',
              ],
              userId,
              timestamp,
            },
          },
          {
            ...alert,
            alertId: 'A-12',
            alertStatus: 'CLOSED',
            priority: 'P1',
            lastStatusChange: {
              reason: [
                'Documents not collected',
                'False positive',
                'Suspicious activity reported (SAR)',
              ],
              userId,
              timestamp,
            },
          },
        ],
        caseAggregates: DEFAULT_CASE_AGGREGATES,
      })
      const stats =
        await statsRepository.getAlertPriorityDistributionStatistics()
      expect(stats).toEqual({
        alertPriorityData: [
          {
            priority: 'P1',
            value: 1,
          },
          {
            priority: 'P2',
            value: 1,
          },
          {
            priority: 'P3',
            value: 2,
          },
          {
            priority: 'P4',
            value: 2,
          },
        ],
      })
    })
  })
})
