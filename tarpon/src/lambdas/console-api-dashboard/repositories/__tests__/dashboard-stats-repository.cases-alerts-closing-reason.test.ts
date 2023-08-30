import { getCaseRepo, getStatsRepo } from './helpers'
import dayjs from '@/utils/dayjs'
import { dynamoDbSetupHook } from '@/test-utils/dynamodb-test-utils'
import { getTestTenantId } from '@/test-utils/tenant-test-utils'
import { Alert } from '@/@types/openapi-internal/Alert'

dynamoDbSetupHook()

type EntityType = 'CASE' | 'ALERT' | undefined

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
    })
    const entityType: EntityType = 'CASE'
    const stats = await statsRepository.getOverviewStatistics([], entityType)
    expect(stats).toEqual({
      totalOpenCases: expect.any(Number),
      totalOpenAlerts: expect.any(Number),
      averageInvestigationTimeCases: undefined,
      averageInvestigationTimeAlerts: undefined,
      closingReasonsData: [
        {
          reason: 'Other',
          value: 2,
        },
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
      ruleDescription: 'test rule description',
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
          lastStatusChange: {
            reason: ['Documents not collected', 'False positive'],
            userId,
            timestamp,
          },
        },
      ],
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
        },
      ],
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
    })
    const entityType: EntityType = 'ALERT'
    const stats = await statsRepository.getOverviewStatistics([], entityType)
    expect(stats).toEqual({
      totalOpenCases: expect.any(Number),
      totalOpenAlerts: expect.any(Number),
      averageInvestigationTimeCases: undefined,
      averageInvestigationTimeAlerts: undefined,
      closingReasonsData: [
        {
          reason: 'Other',
          value: 2,
        },
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
          reason: 'Suspicious activity reported (SAR)',
          value: 3,
        },
      ],
    })
  })
})
