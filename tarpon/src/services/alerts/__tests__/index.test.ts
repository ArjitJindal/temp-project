import { AlertsRepository } from '../repository'
import { AlertsService } from '..'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import { getTestTenantId } from '@/test-utils/tenant-test-utils'
import { CaseRepository } from '@/services/cases/repository'
import { DEFAULT_CASE_AGGREGATES } from '@/utils/case'
import {
  getTestTransaction,
  setUpTransactionsHooks,
} from '@/test-utils/transaction-test-utils'
import { dynamoDbSetupHook } from '@/test-utils/dynamodb-test-utils'
import { withLocalChangeHandler } from '@/utils/local-dynamodb-change-handler'
import { Alert } from '@/@types/openapi-internal/Alert'
import { Priority } from '@/@types/openapi-internal/Priority'
import { getS3ClientByEvent } from '@/utils/s3'
import { Account, AccountsService } from '@/services/accounts'

dynamoDbSetupHook()
withLocalChangeHandler()

const TEST_ALERT: Alert & { alertId: string } = {
  alertId: 'A-1',
  alertStatus: 'OPEN',
  createdTimestamp: 0,
  latestTransactionArrivalTimestamp: 0,
  ruleInstanceId: 'rid-131',
  ruleName: '',
  ruleDescription: '',
  ruleId: '',
  ruleAction: 'FLAG',
  numberOfTransactionsHit: 1,
  priority: 'P1' as Priority,
  transactionIds: ['T-0', 'T-1', 'T-2', 'T-3', 'T-4'],
}

const TEST_ACCOUNT: Account = {
  id: 'ACCOUNT',
  role: 'admin',
  email: 'a@email.com',
  emailVerified: true,
  name: 'ACCOUNT',
  blocked: false,
  isEscalationContact: true,
}

jest.mock('@/core/utils/context', () => {
  const originalModule = jest.requireActual<
    typeof import('@/core/utils/context')
  >('@/core/utils/context')

  return {
    ...originalModule,
    __esModule: true,
    getContext: jest.fn().mockImplementation(() => {
      return {
        user: TEST_ACCOUNT,
      }
    }),
  }
})

jest
  .spyOn(AccountsService.prototype, 'getAccount')
  .mockImplementation(async (_accountId: string) => {
    return TEST_ACCOUNT
  })

describe('test closeAlertIfAllTransactionsApproved', () => {
  const tenantId = getTestTenantId()
  const transactionIds = Array.from({ length: 20 }, (_, i) => `T-${i}`)

  setUpTransactionsHooks(
    tenantId,
    transactionIds.map((id, idx) =>
      getTestTransaction({
        transactionId: id,
        tags: [{ key: 'transactionId', value: id }],
        ...(idx % 3 ? { status: 'ALLOW' } : {}),
      })
    )
  )

  test('should close the alert if all transactions are approved', async () => {
    const mongoDb = await getMongoDbClient()
    const dynamoDb = getDynamoDbClient()

    const caseRepository = new CaseRepository(tenantId, { mongoDb, dynamoDb })
    const timestamp = Date.now()
    await caseRepository.addCaseMongo({
      caseId: 'C-1',
      createdTimestamp: timestamp,
      caseStatus: 'OPEN',
      alerts: [TEST_ALERT],
      caseType: 'SYSTEM',
      caseAggregates: DEFAULT_CASE_AGGREGATES,
      assignments: [],
      reviewAssignments: [],
    })
    const s3 = getS3ClientByEvent(null as any)
    const alertsRepository = new AlertsRepository(tenantId, {
      mongoDb,
    })

    const alertsService = new AlertsService(alertsRepository, s3, {
      documentBucketName: 'test-bucket',
      tmpBucketName: 'test-bucket',
    })
    await alertsService.closeAlertIfAllTransactionsApproved(TEST_ALERT, ['T-3'])
    const case_ = await caseRepository.getCaseById('C-1')
    const alert = await alertsRepository.getAlertById('A-1')

    expect(case_?.caseStatus).toBe('CLOSED')
    expect(alert?.alertStatus).toBe('CLOSED')
    expect(alert?.lastStatusChange).toStrictEqual({
      userId: 'Flagright System',
      timestamp: expect.any(Number),
      reason: ['Other'],
      caseStatus: 'CLOSED',
      otherReason: ' All transactions of this alert are approved',
      meta: { closeSourceCase: null },
      reviewerId: null,
    })
  })

  test('should not close the alert if all transactions are not approved', async () => {
    const mongoDb = await getMongoDbClient()
    const dynamoDb = getDynamoDbClient()

    const caseRepository = new CaseRepository(tenantId, { mongoDb, dynamoDb })
    const timestamp = Date.now()
    await caseRepository.addCaseMongo({
      caseId: 'C-2',
      createdTimestamp: timestamp,
      caseStatus: 'OPEN',
      alerts: [{ ...TEST_ALERT, alertId: 'A-2' }],
      caseType: 'SYSTEM',
      caseAggregates: DEFAULT_CASE_AGGREGATES,
      assignments: [],
      reviewAssignments: [],
    })
    const s3 = getS3ClientByEvent(null as any)
    const alertsRepository = new AlertsRepository(tenantId, {
      mongoDb,
    })

    const alertsService = new AlertsService(alertsRepository, s3, {
      documentBucketName: 'test-bucket',
      tmpBucketName: 'test-bucket',
    })
    await alertsService.closeAlertIfAllTransactionsApproved(TEST_ALERT, ['T-6'])
    const case_ = await caseRepository.getCaseById('C-2')
    const alert = await alertsRepository.getAlertById('A-2')

    expect(case_?.caseStatus).toBe('OPEN')
    expect(alert?.alertStatus).toBe('OPEN')
  })
})
