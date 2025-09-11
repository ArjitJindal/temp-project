import sortBy from 'lodash/sortBy'
import { getCaseRepo, getStatsRepo } from './helpers'
import { getTestTenantId } from '@/test-utils/tenant-test-utils'
import dayjs from '@/utils/dayjs'
import { Case } from '@/@types/openapi-internal/Case'
import { Alert } from '@/@types/openapi-internal/Alert'
import {
  withFeatureHook,
  withFeaturesToggled,
} from '@/test-utils/feature-test-utils'
import { isClickhouseEnabled } from '@/utils/clickhouse/utils'
import { getDynamoDbClient } from '@/utils/dynamodb'

const TEST_ACCOUNT_ID_1 = 'TEST_ACCOUNT_ID_1'
const TEST_ACCOUNT_ID_2 = 'TEST_ACCOUNT_ID_2'

const TEST_CASE_EMPTY_CASE: Case = {
  caseType: 'SYSTEM',
  caseAggregates: {
    originPaymentMethods: [],
    destinationPaymentMethods: [],
    tags: [],
  },
}

const TEST_EMPTY_ALERT: Alert = {
  ruleName: '',
  ruleId: '',
  ruleDescription: '',
  ruleAction: 'FLAG',
  priority: 'P1',
  ruleInstanceId: '',
  numberOfTransactionsHit: 0,
  createdTimestamp: dayjs('2022-01-01T12:00:00.000Z').valueOf(),
}
withFeaturesToggled([], ['CLICKHOUSE_ENABLED'], () => {
  withFeatureHook(['ALERT_SLA'])
  test('Empty db', async () => {
    if (isClickhouseEnabled()) {
      // Clickhouse is enabled, so we don't need to test this
      return
    }
    const TENANT_ID = getTestTenantId()
    const statsRepository = await getStatsRepo(TENANT_ID)
    await statsRepository.refreshTeamStats(getDynamoDbClient())
    const { items, total } = await statsRepository.getSLATeamStatistics()
    expect(items).toEqual([])
    expect(total).toBe(0)
  })

  describe('SLA team stats', () => {
    test('basic stats for 1 alert and 1 assignee', async () => {
      const TENANT_ID = getTestTenantId()
      const caseRepository = await getCaseRepo(TENANT_ID)
      const statsRepository = await getStatsRepo(TENANT_ID)
      const closedTimestamp = dayjs('2022-01-30T12:00:00.000Z').valueOf()
      const caseEntity: Case = {
        ...TEST_CASE_EMPTY_CASE,
        caseId: 'TEST_CASE_ID',
        alerts: [
          {
            ...TEST_EMPTY_ALERT,
            alertId: 'TEST_ALERT_ID',
            assignments: [
              {
                assigneeUserId: TEST_ACCOUNT_ID_1,
                timestamp: dayjs('2022-01-01T12:00:00.000Z').valueOf(),
              },
            ],
            alertStatus: 'CLOSED',
            slaPolicyDetails: [
              {
                policyStatus: 'BREACHED',
                slaPolicyId: '',
              },
            ],
            lastStatusChange: {
              userId: '',
              caseStatus: 'CLOSED',
              timestamp: closedTimestamp,
            },
          },
        ],
      }
      await caseRepository.addCaseMongo(caseEntity)
      await statsRepository.refreshSLATeamStats()
      const { items, total } = await statsRepository.getSLATeamStatistics()
      expect(items).toEqual(
        [
          {
            accountId: TEST_ACCOUNT_ID_1,
            BREACHED: 1,
            OK: 0,
            WARNING: 0,
          },
        ].sort()
      )
      expect(total).toBe(1)
    })
    test('SLA stats for multiple alerts and multiple assignee with timeRanges', async () => {
      const TENANT_ID = getTestTenantId()
      const caseRepository = await getCaseRepo(TENANT_ID)
      const statsRepository = await getStatsRepo(TENANT_ID)
      const closedTimestamp1 = dayjs('2022-01-30T12:00:00.000Z').valueOf()
      const closedTimestamp2 = dayjs('2022-01-31T12:00:00.000Z').valueOf()
      const caseEntity1: Case = {
        ...TEST_CASE_EMPTY_CASE,
        caseId: 'TEST_CASE_ID2',
        alerts: [
          {
            ...TEST_EMPTY_ALERT,
            alertId: 'TEST_ALERT_ID_1',
            assignments: [
              {
                assigneeUserId: TEST_ACCOUNT_ID_1,
                timestamp: dayjs('2022-01-01T12:00:00.000Z').valueOf(),
              },
            ],
            alertStatus: 'CLOSED',
            slaPolicyDetails: [
              {
                policyStatus: 'BREACHED',
                slaPolicyId: '',
              },
            ],
            lastStatusChange: {
              userId: '',
              caseStatus: 'CLOSED',
              timestamp: closedTimestamp1,
            },
          },
          {
            ...TEST_EMPTY_ALERT,
            alertId: 'TEST_ALERT_ID_2',
            assignments: [
              {
                assigneeUserId: TEST_ACCOUNT_ID_2,
                timestamp: dayjs('2022-01-01T12:00:00.000Z').valueOf(),
              },
            ],
            alertStatus: 'CLOSED',
            slaPolicyDetails: [
              {
                policyStatus: 'OK',
                slaPolicyId: '',
              },
            ],
            lastStatusChange: {
              userId: '',
              caseStatus: 'CLOSED',
              timestamp: closedTimestamp1,
            },
          },
        ],
      }
      await caseRepository.addCaseMongo(caseEntity1)
      const caseEntity2: Case = {
        ...TEST_CASE_EMPTY_CASE,
        caseId: 'TEST_CASE_ID3',
        alerts: [
          {
            ...TEST_EMPTY_ALERT,
            alertId: 'TEST_ALERT_ID_3',
            assignments: [
              {
                assigneeUserId: TEST_ACCOUNT_ID_2,
                timestamp: dayjs('2022-01-01T12:00:00.000Z').valueOf(),
              },
            ],
            alertStatus: 'CLOSED',
            slaPolicyDetails: [
              {
                policyStatus: 'WARNING',
                slaPolicyId: '',
              },
            ],
            lastStatusChange: {
              userId: '',
              caseStatus: 'CLOSED',
              timestamp: closedTimestamp2,
            },
          },
          {
            ...TEST_EMPTY_ALERT,
            alertId: 'TEST_ALERT_ID_4',
            assignments: [
              {
                assigneeUserId: TEST_ACCOUNT_ID_2,
                timestamp: dayjs('2022-01-01T12:00:00.000Z').valueOf(),
              },
            ],
            alertStatus: 'CLOSED',
            slaPolicyDetails: [
              {
                policyStatus: 'OK',
                slaPolicyId: '',
              },
            ],
            lastStatusChange: {
              userId: '',
              caseStatus: 'CLOSED',
              timestamp: closedTimestamp1,
            },
          },
        ],
      }
      await caseRepository.addCaseMongo(caseEntity2)
      await statsRepository.refreshSLATeamStats()
      const { items, total } = await statsRepository.getSLATeamStatistics()
      expect(sortBy(items, 'accountId')).toEqual(
        sortBy(
          [
            {
              accountId: TEST_ACCOUNT_ID_1,
              BREACHED: 1,
              OK: 0,
              WARNING: 0,
            },
            {
              accountId: TEST_ACCOUNT_ID_2,
              BREACHED: 0,
              OK: 2,
              WARNING: 1,
            },
          ],
          'accountId'
        )
      )
      expect(total).toBe(2)
      /* Check Time range query */
      const { items: timeBoundItems, total: timeBoundTotal } =
        await statsRepository.getSLATeamStatistics(
          dayjs('2022-01-31T00:00:00.000Z').valueOf(),
          dayjs('2022-02-01T00:00:00.000Z').valueOf()
        )
      expect(timeBoundItems).toEqual([
        {
          accountId: TEST_ACCOUNT_ID_2,
          BREACHED: 0,
          OK: 0,
          WARNING: 1,
        },
      ])
      expect(timeBoundTotal).toBe(1)
    })
  })
})
