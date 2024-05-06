import { getCaseRepo, getStatsRepo } from './helpers'
import dayjs from '@/utils/dayjs'
import { dynamoDbSetupHook } from '@/test-utils/dynamodb-test-utils'
import { getTestTenantId } from '@/test-utils/tenant-test-utils'
import { CaseStatusChange } from '@/@types/openapi-internal/CaseStatusChange'
import { Case } from '@/@types/openapi-internal/Case'
import { CaseStatus } from '@/@types/openapi-internal/CaseStatus'
import { AlertStatus } from '@/@types/openapi-internal/AlertStatus'
import { Alert } from '@/@types/openapi-internal/Alert'
import { Assignment } from '@/@types/openapi-internal/Assignment'
import { DashboardStatsRepository } from '@/lambdas/console-api-dashboard/repositories/dashboard-stats-repository'
import { FLAGRIGHT_SYSTEM_USER } from '@/services/alerts/repository'
import { DEFAULT_CASE_AGGREGATES } from '@/utils/case'

dynamoDbSetupHook()

const TEST_ACCOUNT_ID_1 = 'TEST_ACCOUNT_ID_1'
const TEST_ACCOUNT_ID_2 = 'TEST_ACCOUNT_ID_2'

describe('Team statistic for cases', () => {
  test('Empty db', async () => {
    const TENANT_ID = getTestTenantId()
    const statsRepository = await getStatsRepo(TENANT_ID)

    await statsRepository.refreshTeamStats()
    const stats = await statsRepository.getTeamStatistics('CASES')
    expect(stats).toEqual([])
  })
  describe('closedBy', () => {
    test(`single case with single change`, async () => {
      const TENANT_ID = getTestTenantId()
      const caseRepository = await getCaseRepo(TENANT_ID)
      const statsRepository = await getStatsRepo(TENANT_ID)

      const createdTimestamp = dayjs('2022-01-30T12:00:00.000Z').valueOf()
      const caseEntity = {
        ...emptyCase(),
        createdTimestamp: createdTimestamp,
        statusChanges: [closed(TEST_ACCOUNT_ID_1, createdTimestamp)],
      }
      await caseRepository.addCaseMongo(caseEntity)
      await expectCaseStats(statsRepository, [
        {
          accountId: TEST_ACCOUNT_ID_1,
          closedBy: 1,
          assignedTo: 0,
          caseIds: [],
          investigationTime: 0,
          closedBySystem: 0,
          escalatedBy: 0,
          inProgress: 0,
        },
      ])
      await expectCaseStats(
        statsRepository,
        [
          {
            accountId: TEST_ACCOUNT_ID_1,
            closedBy: 1,
            assignedTo: 0,
            caseIds: [],
            investigationTime: 0,
            closedBySystem: 0,
            escalatedBy: 0,
            inProgress: 0,
          },
        ],
        {
          endTimestamp: createdTimestamp,
        }
      )
      await expectCaseStats(
        statsRepository,
        [
          {
            accountId: 'TEST_ACCOUNT_ID_1',
            assignedTo: 0,
            closedBy: 1,
            caseIds: [],
            investigationTime: 0,
            closedBySystem: 0,
            escalatedBy: 0,
            inProgress: 0,
          },
        ],
        {
          startTimestamp: createdTimestamp,
        }
      )
    })
    test(`single case with multiple changes`, async () => {
      const TENANT_ID = getTestTenantId()
      const caseRepository = await getCaseRepo(TENANT_ID)
      const statsRepository = await getStatsRepo(TENANT_ID)

      await caseRepository.addCaseMongo({
        ...emptyCase(),
        statusChanges: [
          closed(TEST_ACCOUNT_ID_1),
          reopened(TEST_ACCOUNT_ID_2),
          closed(TEST_ACCOUNT_ID_1),
        ],
      })
      await expectCaseStats(statsRepository, [
        {
          accountId: TEST_ACCOUNT_ID_1,
          closedBy: 2,
          assignedTo: 0,
          caseIds: [],
          investigationTime: 0,
          closedBySystem: 0,
          escalatedBy: 0,
          inProgress: 0,
        },
      ])
    })
    test(`multiple cases with multiple changes`, async () => {
      const TENANT_ID = getTestTenantId()
      const caseRepository = await getCaseRepo(TENANT_ID)
      const statsRepository = await getStatsRepo(TENANT_ID)
      await caseRepository.addCaseMongo({
        ...emptyCase(),
        statusChanges: [
          closed(TEST_ACCOUNT_ID_1),
          reopened(TEST_ACCOUNT_ID_2),
          closed(TEST_ACCOUNT_ID_1),
        ],
      })
      await caseRepository.addCaseMongo({
        ...emptyCase(),
        statusChanges: [
          closed(TEST_ACCOUNT_ID_1),
          reopened(TEST_ACCOUNT_ID_2),
          closed(TEST_ACCOUNT_ID_1),
        ],
      })
      await expectCaseStats(statsRepository, [
        {
          accountId: TEST_ACCOUNT_ID_1,
          closedBy: 4,
          assignedTo: 0,
          caseIds: [],
          investigationTime: 0,
          closedBySystem: 0,
          escalatedBy: 0,
          inProgress: 0,
        },
      ])
    })
    test(`multiple cases with multiple changes`, async () => {
      const TENANT_ID = getTestTenantId()
      const caseRepository = await getCaseRepo(TENANT_ID)
      const statsRepository = await getStatsRepo(TENANT_ID)
      await caseRepository.addCaseMongo({
        ...emptyCase(),
        statusChanges: [
          closed(TEST_ACCOUNT_ID_1),
          reopened(TEST_ACCOUNT_ID_2),
          closed(TEST_ACCOUNT_ID_1),
        ],
      })
      await caseRepository.addCaseMongo({
        ...emptyCase(),
        statusChanges: [
          closed(TEST_ACCOUNT_ID_1),
          reopened(TEST_ACCOUNT_ID_2),
          closed(TEST_ACCOUNT_ID_1),
        ],
      })
      await expectCaseStats(statsRepository, [
        {
          accountId: TEST_ACCOUNT_ID_1,
          closedBy: 4,
          assignedTo: 0,
          caseIds: [],
          investigationTime: 0,
          closedBySystem: 0,
          escalatedBy: 0,
          inProgress: 0,
        },
      ])
    })
    test(`multiple users`, async () => {
      const TENANT_ID = getTestTenantId()
      const caseRepository = await getCaseRepo(TENANT_ID)
      const statsRepository = await getStatsRepo(TENANT_ID)

      await caseRepository.addCaseMongo({
        ...emptyCase(),
        statusChanges: [
          closed(TEST_ACCOUNT_ID_1),
          reopened(TEST_ACCOUNT_ID_2),
          closed(TEST_ACCOUNT_ID_1),
        ],
      })
      await caseRepository.addCaseMongo({
        ...emptyCase(),
        statusChanges: [
          closed(TEST_ACCOUNT_ID_2),
          reopened(TEST_ACCOUNT_ID_1),
          closed(TEST_ACCOUNT_ID_2),
        ],
      })
      await expectCaseStats(statsRepository, [
        {
          accountId: TEST_ACCOUNT_ID_1,
          closedBy: 2,
          assignedTo: 0,
          caseIds: [],
          investigationTime: 0,
          closedBySystem: 0,
          escalatedBy: 0,
          inProgress: 0,
        },
        {
          accountId: TEST_ACCOUNT_ID_2,
          closedBy: 2,
          assignedTo: 0,
          caseIds: [],
          investigationTime: 0,
          closedBySystem: 0,
          escalatedBy: 0,
          inProgress: 0,
        },
      ])
    })
    test(`filter by case status`, async () => {
      const TENANT_ID = getTestTenantId()
      const caseRepository = await getCaseRepo(TENANT_ID)
      const statsRepository = await getStatsRepo(TENANT_ID)

      await caseRepository.addCaseMongo({
        ...emptyCase(),
        statusChanges: [
          closed(TEST_ACCOUNT_ID_1),
          reopened(TEST_ACCOUNT_ID_2),
          closed(TEST_ACCOUNT_ID_1),
        ],
      })
      await caseRepository.addCaseMongo({
        ...emptyCase(),
        caseStatus: 'ESCALATED',
        statusChanges: [
          closed(TEST_ACCOUNT_ID_1),
          reopened(TEST_ACCOUNT_ID_2),
          closed(TEST_ACCOUNT_ID_1),
        ],
      })
      await expectCaseStats(
        statsRepository,
        [
          {
            accountId: TEST_ACCOUNT_ID_1,
            closedBy: 2,
            assignedTo: 0,
            caseIds: [],
            investigationTime: 0,
            closedBySystem: 0,
            escalatedBy: 0,
            inProgress: 0,
          },
        ],
        {
          status: ['ESCALATED'],
        }
      )
    })
  })
  describe(`assignedTo`, () => {
    test(`single case with single assignment`, async () => {
      const TENANT_ID = getTestTenantId()
      const caseRepository = await getCaseRepo(TENANT_ID)
      const statsRepository = await getStatsRepo(TENANT_ID)

      const timestamp = dayjs('2022-01-30T12:00:00.000Z').valueOf()
      await caseRepository.addCaseMongo({
        ...emptyCase(),
        createdTimestamp: timestamp,
        assignments: [assignment(TEST_ACCOUNT_ID_1, timestamp)],
      })

      await expectCaseStats(statsRepository, [
        {
          accountId: TEST_ACCOUNT_ID_1,
          closedBy: 0,
          assignedTo: 1,
          caseIds: [],
          investigationTime: 0,
          closedBySystem: 0,
          escalatedBy: 0,
          inProgress: 0,
        },
      ])
      await expectCaseStats(
        statsRepository,
        [
          {
            accountId: TEST_ACCOUNT_ID_1,
            closedBy: 0,
            assignedTo: 1,
            caseIds: [],
            investigationTime: 0,
            closedBySystem: 0,
            escalatedBy: 0,
            inProgress: 0,
          },
        ],
        {
          endTimestamp: timestamp,
        }
      )
      await expectCaseStats(
        statsRepository,
        [
          {
            accountId: 'TEST_ACCOUNT_ID_1',
            assignedTo: 1,
            closedBy: 0,
            caseIds: [],
            investigationTime: 0,
            closedBySystem: 0,
            escalatedBy: 0,
            inProgress: 0,
          },
        ],
        {
          startTimestamp: timestamp,
        }
      )
    })
    test(`multiple cases with multiple assignments`, async () => {
      const TENANT_ID = getTestTenantId()
      const caseRepository = await getCaseRepo(TENANT_ID)
      const statsRepository = await getStatsRepo(TENANT_ID)

      await caseRepository.addCaseMongo({
        ...emptyCase(),
        assignments: [
          assignment(TEST_ACCOUNT_ID_1),
          assignment(TEST_ACCOUNT_ID_1),
        ],
      })
      await caseRepository.addCaseMongo({
        ...emptyCase(),
        assignments: [assignment(TEST_ACCOUNT_ID_1)],
      })
      await caseRepository.addCaseMongo({
        ...emptyCase(),
        assignments: [
          assignment(TEST_ACCOUNT_ID_1),
          assignment(TEST_ACCOUNT_ID_1),
        ],
      })
      await expectCaseStats(statsRepository, [
        {
          accountId: TEST_ACCOUNT_ID_1,
          closedBy: 0,
          assignedTo: 5,
          caseIds: [],
          investigationTime: 0,
          closedBySystem: 0,
          escalatedBy: 0,
          inProgress: 0,
        },
      ])
    })
    test(`multiple accounts assignments`, async () => {
      const TENANT_ID = getTestTenantId()
      const caseRepository = await getCaseRepo(TENANT_ID)
      const statsRepository = await getStatsRepo(TENANT_ID)

      await caseRepository.addCaseMongo({
        ...emptyCase(),
        assignments: [
          assignment(TEST_ACCOUNT_ID_1),
          assignment(TEST_ACCOUNT_ID_1),
          assignment(TEST_ACCOUNT_ID_2),
        ],
      })
      await caseRepository.addCaseMongo({
        ...emptyCase(),
        assignments: [assignment(TEST_ACCOUNT_ID_1)],
      })
      await caseRepository.addCaseMongo({
        ...emptyCase(),
        assignments: [
          assignment(TEST_ACCOUNT_ID_1),
          assignment(TEST_ACCOUNT_ID_2),
          assignment(TEST_ACCOUNT_ID_2),
        ],
      })
      await expectCaseStats(statsRepository, [
        {
          accountId: TEST_ACCOUNT_ID_1,
          closedBy: 0,
          assignedTo: 4,
          caseIds: [],
          investigationTime: 0,
          closedBySystem: 0,
          escalatedBy: 0,
          inProgress: 0,
        },
        {
          accountId: TEST_ACCOUNT_ID_2,
          closedBy: 0,
          assignedTo: 3,
          caseIds: [],
          investigationTime: 0,
          closedBySystem: 0,
          escalatedBy: 0,
          inProgress: 0,
        },
      ])
    })
    test(`filter by case status`, async () => {
      const TENANT_ID = getTestTenantId()
      const caseRepository = await getCaseRepo(TENANT_ID)
      const statsRepository = await getStatsRepo(TENANT_ID)

      await caseRepository.addCaseMongo({
        ...emptyCase(),
        assignments: [
          assignment(TEST_ACCOUNT_ID_1),
          assignment(TEST_ACCOUNT_ID_1),
          assignment(TEST_ACCOUNT_ID_2),
        ],
      })
      await caseRepository.addCaseMongo({
        ...emptyCase(),
        caseStatus: 'OPEN',
        assignments: [assignment(TEST_ACCOUNT_ID_1)],
      })
      await caseRepository.addCaseMongo({
        ...emptyCase(),
        caseStatus: 'OPEN',
        assignments: [
          assignment(TEST_ACCOUNT_ID_1),
          assignment(TEST_ACCOUNT_ID_2),
          assignment(TEST_ACCOUNT_ID_2),
        ],
      })
      await caseRepository.addCaseMongo({
        ...emptyCase(),
        caseStatus: 'ESCALATED',
        assignments: [
          assignment(TEST_ACCOUNT_ID_1),
          assignment(TEST_ACCOUNT_ID_2),
          assignment(TEST_ACCOUNT_ID_2),
        ],
      })
      await expectCaseStats(
        statsRepository,
        [
          {
            accountId: TEST_ACCOUNT_ID_1,
            closedBy: 0,
            assignedTo: 4,
            caseIds: [],
            investigationTime: 0,
            closedBySystem: 0,
            escalatedBy: 0,
            inProgress: 0,
          },
          {
            accountId: TEST_ACCOUNT_ID_2,
            closedBy: 0,
            assignedTo: 3,
            caseIds: [],
            investigationTime: 0,
            closedBySystem: 0,
            escalatedBy: 0,
            inProgress: 0,
          },
        ],
        {
          status: ['OPEN'],
        }
      )
      await expectCaseStats(
        statsRepository,
        [
          {
            accountId: TEST_ACCOUNT_ID_1,
            closedBy: 0,
            assignedTo: 1,
            caseIds: [],
            investigationTime: 0,
            closedBySystem: 0,
            escalatedBy: 0,
            inProgress: 0,
          },
          {
            accountId: TEST_ACCOUNT_ID_2,
            closedBy: 0,
            assignedTo: 2,
            caseIds: [],
            investigationTime: 0,
            closedBySystem: 0,
            escalatedBy: 0,
            inProgress: 0,
          },
        ],
        {
          status: ['ESCALATED'],
        }
      )
    })
  })
  describe(`both`, () => {
    test(`multiple cases, multiple accounts, multiple assignments`, async () => {
      const TENANT_ID = getTestTenantId()
      const caseRepository = await getCaseRepo(TENANT_ID)
      const statsRepository = await getStatsRepo(TENANT_ID)

      await caseRepository.addCaseMongo({
        ...emptyCase(),
        statusChanges: [closed(TEST_ACCOUNT_ID_2)],
        assignments: [
          assignment(TEST_ACCOUNT_ID_1),
          assignment(TEST_ACCOUNT_ID_1),
          assignment(TEST_ACCOUNT_ID_2),
        ],
      })
      await caseRepository.addCaseMongo({
        ...emptyCase(),
        assignments: [assignment(TEST_ACCOUNT_ID_1)],
      })
      await caseRepository.addCaseMongo({
        ...emptyCase(),
        statusChanges: [
          closed(TEST_ACCOUNT_ID_1),
          reopened(TEST_ACCOUNT_ID_2),
          closed(TEST_ACCOUNT_ID_1),
        ],
        assignments: [
          assignment(TEST_ACCOUNT_ID_1),
          assignment(TEST_ACCOUNT_ID_2),
          assignment(TEST_ACCOUNT_ID_2),
        ],
      })
      await expectCaseStats(statsRepository, [
        {
          accountId: TEST_ACCOUNT_ID_1,
          closedBy: 2,
          assignedTo: 4,
          caseIds: [],
          investigationTime: 0,
          closedBySystem: 0,
          escalatedBy: 0,
          inProgress: 0,
        },
        {
          accountId: TEST_ACCOUNT_ID_2,
          closedBy: 1,
          assignedTo: 3,
          caseIds: [],
          investigationTime: 0,
          closedBySystem: 0,
          escalatedBy: 0,
          inProgress: 0,
        },
      ])
    })
    test(`multiple cases, multiple accounts, multiple assignments, filtered by status`, async () => {
      const TENANT_ID = getTestTenantId()
      const caseRepository = await getCaseRepo(TENANT_ID)
      const statsRepository = await getStatsRepo(TENANT_ID)

      await caseRepository.addCaseMongo({
        ...emptyCase(),
        caseStatus: 'OPEN',
        statusChanges: [closed(TEST_ACCOUNT_ID_2)],
        assignments: [
          assignment(TEST_ACCOUNT_ID_1),
          assignment(TEST_ACCOUNT_ID_1),
          assignment(TEST_ACCOUNT_ID_2),
        ],
      })
      await caseRepository.addCaseMongo({
        ...emptyCase(),
        caseStatus: 'OPEN',
        assignments: [assignment(TEST_ACCOUNT_ID_1)],
      })
      await caseRepository.addCaseMongo({
        ...emptyCase(),
        caseStatus: 'OPEN',
        statusChanges: [
          closed(TEST_ACCOUNT_ID_1),
          reopened(TEST_ACCOUNT_ID_2),
          closed(TEST_ACCOUNT_ID_1),
        ],
        assignments: [
          assignment(TEST_ACCOUNT_ID_1),
          assignment(TEST_ACCOUNT_ID_2),
          assignment(TEST_ACCOUNT_ID_2),
        ],
      })
      await caseRepository.addCaseMongo({
        ...emptyCase(),
        caseStatus: 'ESCALATED',
        statusChanges: [
          closed(TEST_ACCOUNT_ID_1),
          reopened(TEST_ACCOUNT_ID_2),
          closed(TEST_ACCOUNT_ID_1),
        ],
        assignments: [
          assignment(TEST_ACCOUNT_ID_1),
          assignment(TEST_ACCOUNT_ID_2),
          assignment(TEST_ACCOUNT_ID_2),
        ],
      })
      await expectCaseStats(
        statsRepository,
        [
          {
            accountId: TEST_ACCOUNT_ID_1,
            closedBy: 2,
            assignedTo: 4,
            caseIds: [],
            investigationTime: 0,
            closedBySystem: 0,
            escalatedBy: 0,
            inProgress: 0,
          },
          {
            accountId: TEST_ACCOUNT_ID_2,
            closedBy: 1,
            assignedTo: 3,
            caseIds: [],
            investigationTime: 0,
            closedBySystem: 0,
            escalatedBy: 0,
            inProgress: 0,
          },
        ],
        {
          status: ['OPEN'],
        }
      )
    })
  })
})

describe('Team statistic for alerts', () => {
  describe('closedBy', () => {
    test(`single alert with single change`, async () => {
      const TENANT_ID = getTestTenantId()
      const caseRepository = await getCaseRepo(TENANT_ID)
      const statsRepository = await getStatsRepo(TENANT_ID)

      const createdTimestamp = dayjs('2022-01-30T12:00:00.000Z').valueOf()
      await caseRepository.addCaseMongo({
        ...emptyCase(),
        alerts: [
          {
            ...emptyAlert(),
            createdTimestamp: createdTimestamp,
            statusChanges: [closed(TEST_ACCOUNT_ID_1, createdTimestamp)],
          },
        ],
      })
      await expectAlertStats(statsRepository, [
        {
          accountId: TEST_ACCOUNT_ID_1,
          closedBy: 1,
          assignedTo: 0,
          caseIds: [],
          investigationTime: 0,
          closedBySystem: 0,
          escalatedBy: 0,
          inProgress: 0,
        },
      ])
      await expectAlertStats(
        statsRepository,
        [
          {
            accountId: TEST_ACCOUNT_ID_1,
            closedBy: 1,
            assignedTo: 0,
            caseIds: [],
            investigationTime: 0,
            closedBySystem: 0,
            escalatedBy: 0,
            inProgress: 0,
          },
        ],
        {
          endTimestamp: createdTimestamp,
        }
      )
      await expectAlertStats(
        statsRepository,
        [
          {
            accountId: 'TEST_ACCOUNT_ID_1',
            assignedTo: 0,
            closedBy: 1,
            caseIds: [],
            investigationTime: 0,
            closedBySystem: 0,
            escalatedBy: 0,
            inProgress: 0,
          },
        ],
        {
          startTimestamp: createdTimestamp,
        }
      )
    })
    test(`two status changes, filtering by alert status`, async () => {
      const TENANT_ID = getTestTenantId()
      const caseRepository = await getCaseRepo(TENANT_ID)
      const statsRepository = await getStatsRepo(TENANT_ID)

      const createdTimestamp = dayjs('2022-01-30T12:00:00.000Z').valueOf()
      await caseRepository.addCaseMongo({
        ...emptyCase(),
        alerts: [
          {
            ...emptyAlert(),
            createdTimestamp: createdTimestamp,
            statusChanges: [closed(TEST_ACCOUNT_ID_1, createdTimestamp)],
          },
          {
            ...emptyAlert(),
            alertStatus: 'CLOSED',
            createdTimestamp: createdTimestamp,
            statusChanges: [closed(TEST_ACCOUNT_ID_1, createdTimestamp)],
          },
        ],
      })
      await expectAlertStats(statsRepository, [
        {
          accountId: TEST_ACCOUNT_ID_1,
          closedBy: 2,
          assignedTo: 0,
          caseIds: [],
          investigationTime: 0,
          closedBySystem: 0,
          escalatedBy: 0,
          inProgress: 0,
        },
      ])
      await expectAlertStats(
        statsRepository,
        [
          {
            accountId: TEST_ACCOUNT_ID_1,
            closedBy: 1,
            assignedTo: 0,
            caseIds: [],
            investigationTime: 0,
            closedBySystem: 0,
            escalatedBy: 0,
            inProgress: 0,
          },
        ],
        {
          status: ['OPEN'],
        }
      )
    })
    test(`single alert with multiple changes`, async () => {
      const TENANT_ID = getTestTenantId()
      const caseRepository = await getCaseRepo(TENANT_ID)
      const statsRepository = await getStatsRepo(TENANT_ID)

      await caseRepository.addCaseMongo({
        ...emptyCase(),
        alerts: [
          {
            ...emptyAlert(),
            statusChanges: [
              closed(TEST_ACCOUNT_ID_1),
              reopened(TEST_ACCOUNT_ID_2),
              closed(TEST_ACCOUNT_ID_1),
            ],
          },
        ],
      })
      await expectAlertStats(statsRepository, [
        {
          accountId: TEST_ACCOUNT_ID_1,
          closedBy: 2,
          assignedTo: 0,
          caseIds: [],
          investigationTime: 0,
          closedBySystem: 0,
          escalatedBy: 0,
          inProgress: 0,
        },
      ])
    })
    test(`multiple alerts with multiple changes`, async () => {
      const TENANT_ID = getTestTenantId()
      const caseRepository = await getCaseRepo(TENANT_ID)
      const statsRepository = await getStatsRepo(TENANT_ID)
      await caseRepository.addCaseMongo({
        ...emptyCase(),
        alerts: [
          {
            ...emptyAlert(),
            statusChanges: [
              closed(TEST_ACCOUNT_ID_1),
              reopened(TEST_ACCOUNT_ID_2),
              closed(TEST_ACCOUNT_ID_1),
            ],
          },
        ],
      })
      await caseRepository.addCaseMongo({
        ...emptyCase(),
        alerts: [
          {
            ...emptyAlert(),
            statusChanges: [
              closed(TEST_ACCOUNT_ID_1),
              reopened(TEST_ACCOUNT_ID_2),
              closed(TEST_ACCOUNT_ID_1),
            ],
          },
        ],
      })
      await expectAlertStats(statsRepository, [
        {
          accountId: TEST_ACCOUNT_ID_1,
          closedBy: 4,
          assignedTo: 0,
          caseIds: [],
          investigationTime: 0,
          closedBySystem: 0,
          escalatedBy: 0,
          inProgress: 0,
        },
      ])
    })
    test(`multiple users`, async () => {
      const TENANT_ID = getTestTenantId()
      const caseRepository = await getCaseRepo(TENANT_ID)
      const statsRepository = await getStatsRepo(TENANT_ID)

      await caseRepository.addCaseMongo({
        ...emptyCase(),
        alerts: [
          {
            ...emptyAlert(),
            statusChanges: [
              closed(TEST_ACCOUNT_ID_1),
              reopened(TEST_ACCOUNT_ID_2),
              closed(TEST_ACCOUNT_ID_1),
            ],
          },
        ],
      })
      await caseRepository.addCaseMongo({
        ...emptyCase(),
        alerts: [
          {
            ...emptyAlert(),
            statusChanges: [
              closed(TEST_ACCOUNT_ID_2),
              reopened(TEST_ACCOUNT_ID_1),
              closed(TEST_ACCOUNT_ID_2),
            ],
          },
        ],
      })
      await expectAlertStats(statsRepository, [
        {
          accountId: TEST_ACCOUNT_ID_1,
          closedBy: 2,
          assignedTo: 0,
          caseIds: [],
          investigationTime: 0,
          closedBySystem: 0,
          escalatedBy: 0,
          inProgress: 0,
        },
        {
          accountId: TEST_ACCOUNT_ID_2,
          closedBy: 2,
          assignedTo: 0,
          caseIds: [],
          investigationTime: 0,
          closedBySystem: 0,
          escalatedBy: 0,
          inProgress: 0,
        },
      ])
    })
  })
  describe(`assignedTo`, () => {
    test(`single alert with single assignment`, async () => {
      const TENANT_ID = getTestTenantId()
      const caseRepository = await getCaseRepo(TENANT_ID)
      const statsRepository = await getStatsRepo(TENANT_ID)

      const timestamp = dayjs('2022-01-30T12:00:00.000Z').valueOf()
      await caseRepository.addCaseMongo({
        ...emptyCase(),
        alerts: [
          {
            ...emptyAlert(),
            createdTimestamp: timestamp,
            assignments: [assignment(TEST_ACCOUNT_ID_1, timestamp)],
          },
        ],
      })

      await expectAlertStats(statsRepository, [
        {
          accountId: TEST_ACCOUNT_ID_1,
          closedBy: 0,
          assignedTo: 1,
          caseIds: [],
          investigationTime: 0,
          closedBySystem: 0,
          escalatedBy: 0,
          inProgress: 0,
        },
      ])
      await expectAlertStats(
        statsRepository,
        [
          {
            accountId: TEST_ACCOUNT_ID_1,
            closedBy: 0,
            assignedTo: 1,
            caseIds: [],
            investigationTime: 0,
            closedBySystem: 0,
            escalatedBy: 0,
            inProgress: 0,
          },
        ],
        {
          endTimestamp: timestamp,
        }
      )
      await expectAlertStats(
        statsRepository,
        [
          {
            accountId: 'TEST_ACCOUNT_ID_1',
            assignedTo: 1,
            closedBy: 0,
            caseIds: [],
            investigationTime: 0,
            closedBySystem: 0,
            escalatedBy: 0,
            inProgress: 0,
          },
        ],
        {
          startTimestamp: timestamp,
        }
      )
    })
    test(`two assignments, status filter`, async () => {
      const TENANT_ID = getTestTenantId()
      const caseRepository = await getCaseRepo(TENANT_ID)
      const statsRepository = await getStatsRepo(TENANT_ID)

      const timestamp = dayjs('2022-01-30T12:00:00.000Z').valueOf()
      await caseRepository.addCaseMongo({
        ...emptyCase(),
        alerts: [
          {
            ...emptyAlert(),
            createdTimestamp: timestamp,
            assignments: [assignment(TEST_ACCOUNT_ID_1, timestamp)],
          },
          {
            ...emptyAlert(),
            alertStatus: 'CLOSED',
            createdTimestamp: timestamp,
            assignments: [assignment(TEST_ACCOUNT_ID_1, timestamp)],
          },
        ],
      })

      await expectAlertStats(
        statsRepository,
        [
          {
            accountId: TEST_ACCOUNT_ID_1,
            closedBy: 0,
            assignedTo: 1,
            caseIds: [],
            investigationTime: 0,
            closedBySystem: 0,
            escalatedBy: 0,
            inProgress: 0,
          },
        ],
        {
          status: ['OPEN'],
        }
      )
    })
    test(`multiple alert with multiple assignments`, async () => {
      const TENANT_ID = getTestTenantId()
      const caseRepository = await getCaseRepo(TENANT_ID)
      const statsRepository = await getStatsRepo(TENANT_ID)

      await caseRepository.addCaseMongo({
        ...emptyCase(),
        alerts: [
          {
            ...emptyAlert(),
            assignments: [
              assignment(TEST_ACCOUNT_ID_1),
              assignment(TEST_ACCOUNT_ID_1),
            ],
          },
        ],
      })
      await caseRepository.addCaseMongo({
        ...emptyCase(),
        alerts: [
          {
            ...emptyAlert(),
            assignments: [assignment(TEST_ACCOUNT_ID_1)],
          },
        ],
      })
      await caseRepository.addCaseMongo({
        ...emptyCase(),
        alerts: [
          {
            ...emptyAlert(),
            assignments: [
              assignment(TEST_ACCOUNT_ID_1),
              assignment(TEST_ACCOUNT_ID_1),
            ],
          },
        ],
      })
      await expectAlertStats(statsRepository, [
        {
          accountId: TEST_ACCOUNT_ID_1,
          closedBy: 0,
          assignedTo: 5,
          caseIds: [],
          investigationTime: 0,
          closedBySystem: 0,
          escalatedBy: 0,
          inProgress: 0,
        },
      ])
    })
    test(`multiple accounts assignments`, async () => {
      const TENANT_ID = getTestTenantId()
      const caseRepository = await getCaseRepo(TENANT_ID)
      const statsRepository = await getStatsRepo(TENANT_ID)

      await caseRepository.addCaseMongo({
        ...emptyCase(),
        alerts: [
          {
            ...emptyAlert(),
            assignments: [
              assignment(TEST_ACCOUNT_ID_1),
              assignment(TEST_ACCOUNT_ID_1),
              assignment(TEST_ACCOUNT_ID_2),
            ],
          },
        ],
      })
      await caseRepository.addCaseMongo({
        ...emptyCase(),

        alerts: [
          {
            ...emptyAlert(),
            assignments: [assignment(TEST_ACCOUNT_ID_1)],
          },
        ],
      })
      await caseRepository.addCaseMongo({
        ...emptyCase(),
        alerts: [
          {
            ...emptyAlert(),
            assignments: [
              assignment(TEST_ACCOUNT_ID_1),
              assignment(TEST_ACCOUNT_ID_2),
              assignment(TEST_ACCOUNT_ID_2),
            ],
          },
        ],
      })
      await expectAlertStats(statsRepository, [
        {
          accountId: TEST_ACCOUNT_ID_1,
          closedBy: 0,
          assignedTo: 4,
          caseIds: [],
          investigationTime: 0,
          closedBySystem: 0,
          escalatedBy: 0,
          inProgress: 0,
        },
        {
          accountId: TEST_ACCOUNT_ID_2,
          closedBy: 0,
          assignedTo: 3,
          caseIds: [],
          investigationTime: 0,
          closedBySystem: 0,
          escalatedBy: 0,
          inProgress: 0,
        },
      ])
    })
  })
  describe(`both`, () => {
    test(`multiple alerts, multiple accounts, multiple assignments`, async () => {
      const TENANT_ID = getTestTenantId()
      const caseRepository = await getCaseRepo(TENANT_ID)
      const statsRepository = await getStatsRepo(TENANT_ID)

      await caseRepository.addCaseMongo({
        ...emptyCase(),
        alerts: [
          {
            ...emptyAlert(),
            statusChanges: [closed(TEST_ACCOUNT_ID_2)],
            assignments: [
              assignment(TEST_ACCOUNT_ID_1),
              assignment(TEST_ACCOUNT_ID_1),
              assignment(TEST_ACCOUNT_ID_2),
            ],
          },
        ],
      })
      await caseRepository.addCaseMongo({
        ...emptyCase(),
        alerts: [
          {
            ...emptyAlert(),
            assignments: [assignment(TEST_ACCOUNT_ID_1)],
          },
        ],
      })
      await caseRepository.addCaseMongo({
        ...emptyCase(),
        alerts: [
          {
            ...emptyAlert(),
            statusChanges: [
              closed(TEST_ACCOUNT_ID_1),
              reopened(TEST_ACCOUNT_ID_2),
              closed(TEST_ACCOUNT_ID_1),
            ],
            assignments: [
              assignment(TEST_ACCOUNT_ID_1),
              assignment(TEST_ACCOUNT_ID_2),
              assignment(TEST_ACCOUNT_ID_2),
            ],
          },
        ],
      })
      await expectAlertStats(statsRepository, [
        {
          accountId: TEST_ACCOUNT_ID_1,
          closedBy: 2,
          assignedTo: 4,
          caseIds: [],
          investigationTime: 0,
          closedBySystem: 0,
          escalatedBy: 0,
          inProgress: 0,
        },
        {
          accountId: TEST_ACCOUNT_ID_2,
          closedBy: 1,
          assignedTo: 3,
          caseIds: [],
          investigationTime: 0,
          closedBySystem: 0,
          escalatedBy: 0,
          inProgress: 0,
        },
      ])
    })
  })

  describe('Test Closed By Syatem for Alerts', () => {
    test(`closed by system`, async () => {
      const TENANT_ID = getTestTenantId()
      const caseRepository = await getCaseRepo(TENANT_ID)
      const statsRepository = await getStatsRepo(TENANT_ID)

      await caseRepository.addCaseMongo({
        ...emptyCase(),
        alerts: [
          {
            ...emptyAlert(),
            statusChanges: [closedBySystem()],
            assignments: [assignment(TEST_ACCOUNT_ID_1)],
          },
          {
            ...emptyAlert(),
            statusChanges: [closedBySystem()],
            assignments: [assignment(TEST_ACCOUNT_ID_1)],
          },
        ],
        statusChanges: [
          {
            ...closedBySystem(),
            userId: TEST_ACCOUNT_ID_1,
          },
        ],
      })

      await expectAlertStats(statsRepository, [
        {
          accountId: 'Flagright System',
          assignedTo: 0,
          closedBy: 2,
          closedBySystem: 0,
          escalatedBy: 0,
          inProgress: 0,
          caseIds: [],
          investigationTime: 0,
        },
        {
          accountId: 'TEST_ACCOUNT_ID_1',
          assignedTo: 2,
          closedBy: 0,
          closedBySystem: 2,
          caseIds: [],
          investigationTime: 0,
          escalatedBy: 0,
          inProgress: 0,
        },
      ])
    })

    test(`closed by system semi work`, async () => {
      const TENANT_ID = getTestTenantId()
      const caseRepository = await getCaseRepo(TENANT_ID)
      const statsRepository = await getStatsRepo(TENANT_ID)

      await caseRepository.addCaseMongo({
        ...emptyCase(),
        alerts: [
          {
            ...emptyAlert(),
            statusChanges: [{ ...closedBySystem(), userId: TEST_ACCOUNT_ID_1 }],
            assignments: [assignment(TEST_ACCOUNT_ID_1)],
          },
          {
            ...emptyAlert(),
            statusChanges: [closedBySystem()],
            assignments: [assignment(TEST_ACCOUNT_ID_1)],
          },
        ],
        statusChanges: [
          {
            ...closedBySystem(),
            userId: TEST_ACCOUNT_ID_1,
          },
        ],
      })

      await expectAlertStats(statsRepository, [
        {
          accountId: 'TEST_ACCOUNT_ID_1',
          assignedTo: 2,
          closedBy: 1,
          closedBySystem: 1,
          caseIds: [],
          investigationTime: 0,
          escalatedBy: 0,
          inProgress: 0,
        },
        {
          accountId: 'Flagright System',
          assignedTo: 0,
          closedBy: 1,
          closedBySystem: 0,
          escalatedBy: 0,
          inProgress: 0,
          caseIds: [],
          investigationTime: 0,
        },
      ])
    })
  })

  describe('Test Closed By Syatem for Cases', () => {
    test(`closed by system case`, async () => {
      const TENANT_ID = getTestTenantId()
      const caseRepository = await getCaseRepo(TENANT_ID)
      const statsRepository = await getStatsRepo(TENANT_ID)

      await caseRepository.addCaseMongo({
        ...emptyCase(),
        statusChanges: [closedBySystem()],
        assignments: [assignment(TEST_ACCOUNT_ID_1)],
        alerts: [
          {
            ...emptyAlert(),
            statusChanges: [closed(TEST_ACCOUNT_ID_1)],
          },
          {
            ...emptyAlert(),
            statusChanges: [closed(TEST_ACCOUNT_ID_1)],
          },
        ],
      })

      await expectCaseStats(statsRepository, [
        {
          accountId: 'TEST_ACCOUNT_ID_1',
          assignedTo: 1,
          closedBy: 0,
          closedBySystem: 1,
          caseIds: [],
          investigationTime: 0,
          escalatedBy: 0,
          inProgress: 0,
        },
        {
          accountId: 'Flagright System',
          assignedTo: 0,
          closedBy: 1,
          closedBySystem: 0,
          escalatedBy: 0,
          inProgress: 0,
          caseIds: [],
          investigationTime: 0,
        },
      ])
    })

    test(`closed by system not work`, async () => {
      const TENANT_ID = getTestTenantId()
      const caseRepository = await getCaseRepo(TENANT_ID)
      const statsRepository = await getStatsRepo(TENANT_ID)

      await caseRepository.addCaseMongo({
        ...emptyCase(),
        statusChanges: [closedBySystem()],
        assignments: [assignment(TEST_ACCOUNT_ID_1)],
        alerts: [
          {
            ...emptyAlert(),
            statusChanges: [closed(TEST_ACCOUNT_ID_2)],
          },
          {
            ...emptyAlert(),
            statusChanges: [closed(TEST_ACCOUNT_ID_1)],
          },
        ],
      })

      await expectCaseStats(statsRepository, [
        {
          accountId: 'TEST_ACCOUNT_ID_1',
          assignedTo: 1,
          closedBy: 0,
          closedBySystem: 0,
          escalatedBy: 0,
          inProgress: 0,
          caseIds: [],
          investigationTime: 0,
        },
        {
          accountId: 'Flagright System',
          assignedTo: 0,
          closedBy: 1,
          closedBySystem: 0,
          escalatedBy: 0,
          inProgress: 0,
          caseIds: [],
          investigationTime: 0,
        },
      ])
    })
  })

  describe('Test Closed Investigation Time', () => {
    test('Investigation Time Case', async () => {
      const TENANT_ID = getTestTenantId()
      const caseRepository = await getCaseRepo(TENANT_ID)
      const statsRepository = await getStatsRepo(TENANT_ID)

      await caseRepository.addCaseMongo({
        ...emptyCase(),
        statusChanges: [
          inProgressOpen(TEST_ACCOUNT_ID_1, 0),
          closed(TEST_ACCOUNT_ID_1, 5000),
        ],
        assignments: [assignment(TEST_ACCOUNT_ID_1)],
      })

      await expectCaseStats(statsRepository, [
        {
          accountId: 'TEST_ACCOUNT_ID_1',
          assignedTo: 1,
          closedBy: 1,
          closedBySystem: 0,
          escalatedBy: 0,
          inProgress: 1,
          caseIds: [expect.any(String)],
          investigationTime: 5000,
        },
      ])
    })
  })

  describe('Test Escalated By', () => {
    test('Escalated By Case', async () => {
      const TENANT_ID = getTestTenantId()
      const caseRepository = await getCaseRepo(TENANT_ID)
      const statsRepository = await getStatsRepo(TENANT_ID)

      await caseRepository.addCaseMongo({
        ...emptyCase(),
        caseStatus: 'ESCALATED_IN_PROGRESS',
        statusChanges: [
          escalated(TEST_ACCOUNT_ID_1, 0),
          escalatedInProgress(TEST_ACCOUNT_ID_1, 1000),
          escalated(TEST_ACCOUNT_ID_1, 2000),
          escalatedInProgress(TEST_ACCOUNT_ID_1, 3000),
          escalatedOnHold(TEST_ACCOUNT_ID_1, 4000),
          escalated(TEST_ACCOUNT_ID_1, 5000),
          closed(TEST_ACCOUNT_ID_1, 6000),
          escalated(TEST_ACCOUNT_ID_1, 7000),
        ],
        assignments: [assignment(TEST_ACCOUNT_ID_1)],
      })

      await expectCaseStats(statsRepository, [
        {
          accountId: 'TEST_ACCOUNT_ID_1',
          assignedTo: 1,
          caseIds: [],
          closedBy: 1,
          closedBySystem: 0,
          escalatedBy: 4,
          inProgress: 2,
          investigationTime: 0,
        },
      ])
    })
  })
})

/*
  Helpers
 */
let counter = 0
function emptyCase(): Case {
  return {
    caseType: 'SYSTEM',
    caseId: `C-${counter++}`,
    caseStatus: 'OPEN',
    createdTimestamp: Date.now(),
    caseTransactionsIds: [],
    statusChanges: [],
    assignments: [],
    caseAggregates: DEFAULT_CASE_AGGREGATES,
  }
}

function closedBySystem(): CaseStatusChange {
  return {
    caseStatus: 'CLOSED',
    timestamp: Date.now(),
    userId: FLAGRIGHT_SYSTEM_USER,
    otherReason: '',
    reason: [],
  }
}

function emptyAlert(): Alert {
  return {
    alertId: `C-${counter++}`,
    alertStatus: 'OPEN',
    createdTimestamp: Date.now(),
    ruleInstanceId: '',
    ruleId: '',
    ruleName: '',
    ruleDescription: '',
    ruleAction: 'BLOCK',
    numberOfTransactionsHit: 0,
    priority: 'P1',
  }
}

async function expectCaseStats(
  repo: DashboardStatsRepository,
  toExpect: {
    accountId: string
    closedBy: number
    assignedTo: number
    caseIds: Array<any>
    investigationTime: number
    closedBySystem: number
    escalatedBy: number
    inProgress: number
  }[],
  filters?: {
    startTimestamp?: number
    endTimestamp?: number
    status?: CaseStatus[]
  }
) {
  await repo.refreshTeamStats()
  const stats = await repo.getTeamStatistics(
    'CASES',
    filters?.startTimestamp,
    filters?.endTimestamp,
    filters?.status
  )
  expect(stats).toHaveLength(toExpect.length)
  expect(stats).toEqual(expect.arrayContaining(toExpect))
}

async function expectAlertStats(
  repo: DashboardStatsRepository,
  toExpect: {
    accountId: string
    closedBy: number
    assignedTo: number
    caseIds: string[]
    investigationTime: number
    closedBySystem: number
    escalatedBy: number
    inProgress: number
  }[],
  dateFilter?: {
    startTimestamp?: number
    endTimestamp?: number
    status?: AlertStatus[]
  }
) {
  await repo.refreshTeamStats()
  const stats = await repo.getTeamStatistics(
    'ALERTS',
    dateFilter?.startTimestamp,
    dateFilter?.endTimestamp,
    dateFilter?.status
  )
  expect(stats).toHaveLength(toExpect.length)
  expect(stats).toEqual(expect.arrayContaining(toExpect))
}

function assignment(userId: string, timestamp?: number): Assignment {
  return {
    assigneeUserId: userId,
    timestamp: timestamp ?? Date.now(),
  }
}

function closed(userId: string, timestamp?: number): CaseStatusChange {
  return {
    userId: userId,
    caseStatus: 'CLOSED',
    timestamp: timestamp ?? Date.now(),
  }
}

function reopened(userId: string, timestamp?: number): CaseStatusChange {
  return {
    userId: userId,
    caseStatus: 'REOPENED',
    timestamp: timestamp ?? Date.now(),
  }
}

function inProgressOpen(userId: string, timestamp?: number): CaseStatusChange {
  return {
    userId: userId,
    caseStatus: 'OPEN_IN_PROGRESS',
    timestamp: timestamp ?? Date.now(),
  }
}

function escalated(userId: string, timestamp?: number): CaseStatusChange {
  return {
    userId: userId,
    caseStatus: 'ESCALATED',
    timestamp: timestamp ?? Date.now(),
  }
}

function escalatedInProgress(
  userId: string,
  timestamp?: number
): CaseStatusChange {
  return {
    userId: userId,
    caseStatus: 'ESCALATED_IN_PROGRESS',
    timestamp: timestamp ?? Date.now(),
  }
}

function escalatedOnHold(userId: string, timestamp?: number): CaseStatusChange {
  return {
    userId: userId,
    caseStatus: 'ESCALATED_ON_HOLD',
    timestamp: timestamp ?? Date.now(),
  }
}
