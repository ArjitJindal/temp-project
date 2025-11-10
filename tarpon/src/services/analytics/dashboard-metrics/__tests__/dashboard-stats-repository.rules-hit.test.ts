import {
  getCaseRepo,
  getStatsRepo,
  getTransactionsRepo,
  getUserRepo,
  hitRule,
} from './helpers'
import dayjs from '@/utils/dayjs'
import { dynamoDbSetupHook } from '@/test-utils/dynamodb-test-utils'
import {
  getTestTransaction,
  getTestTransactionEvent,
} from '@/test-utils/transaction-test-utils'
import { getTestTenantId } from '@/test-utils/tenant-test-utils'
import { RuleAction } from '@/@types/openapi-internal/RuleAction'
import { DEFAULT_CASE_AGGREGATES } from '@/constants/case-creation'
import { Alert } from '@/@types/openapi-internal/Alert'
import { Priority } from '@/@types/openapi-internal/Priority'
import { withFeaturesToggled } from '@/test-utils/feature-test-utils'
import { getTestUser } from '@/test-utils/user-test-utils'
import { InternalConsumerUser } from '@/@types/openapi-internal/InternalConsumerUser'
import { createRule } from '@/test-utils/rule-test-utils'
import { RulesEngineService } from '@/services/rules-engine/rules-engine-service'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { LogicEvaluator } from '@/services/logic-evaluator/engine'
import { getApiGatewayPostEvent } from '@/test-utils/apigateway-test-utils'
import { enableLocalChangeHandler } from '@/utils/local-change-handler'
import { transactionEventHandler } from '@/lambdas/public-api-transaction-event/app'

enableLocalChangeHandler()
dynamoDbSetupHook()

const TEST_ALERT: Alert = {
  alertId: 'A-1',
  alertStatus: 'OPEN',
  createdTimestamp: 0,
  latestTransactionArrivalTimestamp: 0,
  ruleName: '',
  ruleDescription: '',
  ruleId: 'R-1',
  ruleInstanceId: '1',
  ruleAction: 'FLAG',
  numberOfTransactionsHit: 1,
  priority: 'P1' as Priority,
  transactionIds: ['T-0', 'T-1', 'T-2', 'T-3', 'T-4'],
}

withFeaturesToggled(['RISK_SCORING'], ['CLICKHOUSE_ENABLED'], () => {
  let TENANT_ID
  describe('Verify alerts stats', () => {
    beforeEach(async () => {
      TENANT_ID = getTestTenantId()
    })
    test(`Single alert`, async () => {
      const dynamoDb = getDynamoDbClient()
      const mongoDb = await getMongoDbClient()
      const logicEvaluator = new LogicEvaluator(TENANT_ID, dynamoDb)
      const rulesEngine = new RulesEngineService(
        TENANT_ID,
        dynamoDb,
        logicEvaluator,
        mongoDb
      )
      const caseRepository = await getCaseRepo(TENANT_ID)
      const statsRepository = await getStatsRepo(TENANT_ID)
      const transactionRepository = await getTransactionsRepo(TENANT_ID)
      const userRepository = await getUserRepo(TENANT_ID)
      const originUser = (await getTestUser({
        userId: 'test-user-id',
      })) as InternalConsumerUser
      const destinationUser = (await getTestUser({
        userId: 'test-user-id-2',
      })) as InternalConsumerUser
      await userRepository.saveUserMongo(originUser)
      await userRepository.saveUserMongo(destinationUser)
      const hitRules = [hitRule()]
      await createRule(
        TENANT_ID,
        {
          id: 'R-1',
          type: 'TRANSACTION',
          name: 'test rule name',
        },
        {
          id: '1',
          ruleId: 'R-1',
        }
      )
      const transactions = [
        {
          ...getTestTransaction({
            timestamp: dayjs('2022-01-30T12:00:00.000Z').valueOf(),
          }),
          status: 'BLOCK' as RuleAction,
          hitRules: hitRules,
          executedRules: hitRules,
          originUserId: originUser.userId,
          destinationUserId: destinationUser.userId,
        },
        {
          ...getTestTransaction({
            timestamp: dayjs('2022-01-30T18:00:00.000Z').valueOf(),
          }),
          status: 'BLOCK' as RuleAction,
          hitRules: hitRules,
          executedRules: hitRules,
          originUserId: originUser.userId,
          destinationUserId: destinationUser.userId,
        },
      ]

      await Promise.all(
        transactions.map((t) =>
          transactionRepository.addTransactionToMongo({
            ...t,
            originUserId: t.originUserId,
            destinationUserId: t.destinationUserId,
          })
        )
      )

      const txnEvent = [
        getTestTransactionEvent({
          transactionId: transactions[0].transactionId,
          eventId: '1',
          hitRules,
          executedRules: hitRules,
        }),
        getTestTransactionEvent({
          transactionId: transactions[1].transactionId,
          eventId: '2',
          hitRules,
          executedRules: hitRules,
        }),
      ]

      await transactionEventHandler(
        getApiGatewayPostEvent(TENANT_ID, '/events/transaction', txnEvent[0]),
        null as any,
        null as any
      )

      await Promise.all(
        transactions.map((t) => rulesEngine.verifyTransaction(t))
      )

      const createdTimestamp = dayjs('2022-01-30T12:00:00.000Z').valueOf()
      await caseRepository.addCaseMongo({
        caseId: 'C-1',
        caseType: 'SYSTEM',
        createdTimestamp,
        caseTransactionsIds: transactions.map((t) => t.transactionId),
        caseAggregates: DEFAULT_CASE_AGGREGATES,
        updatedAt: createdTimestamp,
        alerts: [
          {
            ...TEST_ALERT,
            alertId: 'A-1',
            createdTimestamp: createdTimestamp,
            transactionIds: transactions.map((t) => t.transactionId),
          },
        ],
      })
      await statsRepository.refreshRuleHitStats({
        startTimestamp: createdTimestamp,
      })
      const stats = await statsRepository.getRuleHitCountStats(
        dayjs('2022-01-30T11:00:00.000Z').valueOf(),
        dayjs('2022-01-30T13:00:00.000Z').valueOf()
      )
      expect(stats).toEqual({
        data: [
          {
            ruleId: 'R-1',
            ruleInstanceId: '1',
            hitCount: 0,
            openAlertsCount: 1,
            runCount: 1,
          },
        ],
        total: 1,
      })
    })

    test(`Multiple cases`, async () => {
      const dynamoDb = getDynamoDbClient()
      const mongoDb = await getMongoDbClient()
      const logicEvaluator = new LogicEvaluator(TENANT_ID, dynamoDb)
      const rulesEngine = new RulesEngineService(
        TENANT_ID,
        dynamoDb,
        logicEvaluator,
        mongoDb
      )
      const caseRepository = await getCaseRepo(TENANT_ID)
      const statsRepository = await getStatsRepo(TENANT_ID)
      const transactionRepository = await getTransactionsRepo(TENANT_ID)
      const userRepository = await getUserRepo(TENANT_ID)
      const originUser = (await getTestUser({
        userId: 'test-user-id',
      })) as InternalConsumerUser
      const destinationUser = (await getTestUser({
        userId: 'test-user-id-2',
      })) as InternalConsumerUser
      await userRepository.saveUserMongo(originUser)
      await userRepository.saveUserMongo(destinationUser)
      const timestamp = dayjs('2022-01-30T12:00:00.000Z').valueOf()
      await createRule(
        TENANT_ID,
        {
          id: 'R-1',
          type: 'TRANSACTION',
          name: 'test rule name',
        },
        {
          id: '1',
          ruleId: 'R-1',
        }
      )
      const transaction = {
        ...getTestTransaction({
          timestamp,
        }),
        status: 'BLOCK' as RuleAction,
        hitRules: [hitRule()],
        executedRules: [hitRule()],
        originUserId: originUser.userId,
        destinationUserId: destinationUser.userId,
        caseAggregates: DEFAULT_CASE_AGGREGATES,
      }

      await transactionRepository.addTransactionToMongo(transaction)

      const txnEvent = [
        getTestTransactionEvent({
          transactionId: transaction.transactionId,
          eventId: '1',
          hitRules: [hitRule()],
          executedRules: [hitRule()],
        }),
      ]

      await transactionEventHandler(
        getApiGatewayPostEvent(TENANT_ID, '/events/transaction', txnEvent[0]),
        null as any,
        null as any
      )

      await rulesEngine.verifyTransaction(transaction)

      await caseRepository.addCaseMongo({
        caseId: 'C-1',
        createdTimestamp: timestamp,
        caseType: 'SYSTEM',
        caseTransactionsIds: [transaction.transactionId],
        caseAggregates: DEFAULT_CASE_AGGREGATES,
        updatedAt: timestamp,
        alerts: [
          {
            ...TEST_ALERT,
            alertId: 'A-1',
            createdTimestamp: timestamp,
            transactionIds: [transaction.transactionId],
          },
        ],
      })
      await caseRepository.addCaseMongo({
        caseId: 'C-2',
        createdTimestamp: timestamp,
        caseType: 'SYSTEM',
        caseTransactionsIds: [transaction.transactionId],
        caseAggregates: DEFAULT_CASE_AGGREGATES,
        updatedAt: timestamp,
        alerts: [
          {
            ...TEST_ALERT,
            alertId: 'A-2',
            createdTimestamp: timestamp,
            transactionIds: [transaction.transactionId],
          },
        ],
      })
      await caseRepository.addCaseMongo({
        caseId: 'C-3',
        caseType: 'SYSTEM',
        createdTimestamp: timestamp,
        caseTransactionsIds: [transaction.transactionId],
        caseAggregates: DEFAULT_CASE_AGGREGATES,
        updatedAt: timestamp,
        alerts: [
          {
            ...TEST_ALERT,
            alertId: 'A-3',
            createdTimestamp: timestamp,
            transactionIds: [transaction.transactionId],
          },
        ],
      })
      await statsRepository.refreshRuleHitStats({ startTimestamp: timestamp })
      const stats = await statsRepository.getRuleHitCountStats(
        dayjs('2022-01-30T00:00:00.000Z').valueOf(),
        dayjs('2022-01-31T00:00:00.000Z').valueOf()
      )
      expect(stats).toEqual({
        data: [
          {
            ruleId: 'R-1',
            ruleInstanceId: '1',
            hitCount: 0,
            openAlertsCount: 3,
            runCount: 1,
          },
        ],
        total: 1,
      })
    })
  })
})
