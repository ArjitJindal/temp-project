import {
  createTransactionEvent,
  getStatsRepo,
  getTransactionsRepo,
} from './helpers'
import { RulesEngineService } from '@/services/rules-engine/rules-engine-service'
import { LogicEvaluator } from '@/services/logic-evaluator/engine'
import { withFeaturesToggled } from '@/test-utils/feature-test-utils'
import { getTestTenantId } from '@/test-utils/tenant-test-utils'
import {
  getTestTransaction,
  getTestTransactionEvent,
} from '@/test-utils/transaction-test-utils'
import dayjs from '@/utils/dayjs'
import { enableLocalChangeHandler } from '@/utils/local-dynamodb-change-handler'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import { Account } from '@/@types/openapi-internal/Account'
import { MongoDbTransactionRepository } from '@/services/rules-engine/repositories/mongodb-transaction-repository'
import { DashboardStatsRepository } from '@/services/dashboard/repositories/dashboard-stats-repository'
const TEST_ACCOUNT: Account = {
  id: 'foo',
  role: 'admin',
  email: 'a@email.com',
  emailVerified: true,
  name: 'foo',
  blocked: false,
  escalationLevel: 'L1',
}
const MIDDLE_OF_JAN = '2025-01-15T12:00:00.000Z'

const fakeTimers = jest.useFakeTimers({
  advanceTimers: true,
  doNotFake: ['performance'],
})

enableLocalChangeHandler()
withFeaturesToggled([], ['CLICKHOUSE_ENABLED'], () => {
  const TENANT_ID = getTestTenantId()
  let transactionRepository: MongoDbTransactionRepository
  let statsRepository: DashboardStatsRepository

  beforeEach(async () => {
    transactionRepository = await getTransactionsRepo(TENANT_ID)
    statsRepository = await getStatsRepo(TENANT_ID)
    fakeTimers.setSystemTime(new Date(MIDDLE_OF_JAN))
  })
  describe('Payment Approvals', () => {
    it('transaction with no approved/blocked event', async () => {
      const d = dayjs('2025-01-01T00:00:00.000Z')
      const timestamp = d.valueOf()
      const transaction = getTestTransaction({
        transactionId: 'foo',
        transactionState: 'CREATED',
        timestamp,
      })
      const transactionEvent = getTestTransactionEvent({
        transactionId: 'foo',
        status: 'ALLOW',
        timestamp: dayjs('2025-01-02T00:00:00.000Z').valueOf(),
      })

      await transactionRepository.addTransactionToMongo({
        ...transaction,
        status: 'SUSPEND',
        hitRules: [],
        executedRules: [],
      })
      await createTransactionEvent(TENANT_ID, transaction, transactionEvent, {
        userId: TEST_ACCOUNT.id,
        email: TEST_ACCOUNT.email,
      })
      const paymentApprovals =
        await statsRepository.getPaymentApprovalsStatistics(
          dayjs('2025-01-01T00:00:00.000Z').valueOf(),
          dayjs('2025-01-01T18:00:00.000Z').valueOf()
        )
      expect(paymentApprovals).toEqual([])
    })
    it('transaction with approved event', async () => {
      const mongoDb = await getMongoDbClient()
      const dynamoDb = getDynamoDbClient()
      const d = dayjs('2025-01-01T00:00:00.000Z')
      const timestamp = d.valueOf()
      const transaction = getTestTransaction({
        transactionId: 'foo',
        transactionState: 'CREATED',
        timestamp,
        createdAt: timestamp,
      })

      await transactionRepository.addTransactionToMongo({
        ...transaction,
        status: 'ALLOW',
        hitRules: [],
        executedRules: [],
      })
      const logicEvaluator = new LogicEvaluator(TENANT_ID, dynamoDb)
      const rulesEngineService = new RulesEngineService(
        TENANT_ID,
        dynamoDb,
        logicEvaluator,
        mongoDb
      )
      await rulesEngineService.applyTransactionAction(
        {
          transactionIds: ['foo'],
          action: 'ALLOW',
          reason: ['Other'],
          comment: 'test',
        },
        TEST_ACCOUNT.id
      )
      const paymentApprovals =
        await statsRepository.getPaymentApprovalsStatistics(
          dayjs('2025-01-01T00:00:00.000Z').valueOf(),
          dayjs('2025-01-31T00:00:00.000Z').valueOf()
        )
      expect(paymentApprovals).toEqual([
        {
          accountId: 'foo',
          averageDecisionTime: expect.any(Number),
          approved: 1,
          blocked: 0,
        },
      ])
    })
  })
})
