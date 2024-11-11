import { RuleInstanceService } from '../rule-instance-service'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import { getTestTenantId } from '@/test-utils/tenant-test-utils'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { getTestRuleInstance } from '@/test-utils/rule-test-utils'
import {
  getTestTransaction,
  setUpTransactionsHooks,
} from '@/test-utils/transaction-test-utils'
import dayjs from '@/utils/dayjs'
import { dynamoDbSetupHook } from '@/test-utils/dynamodb-test-utils'
import { withFeatureHook } from '@/test-utils/feature-test-utils'
import { enableLocalChangeHandler } from '@/utils/local-dynamodb-change-handler'
import { DashboardStatsRepository } from '@/services/dashboard/repositories/dashboard-stats-repository'
import { getTestUser, setUpUsersHooks } from '@/test-utils/user-test-utils'

function getTestTransactionHitOrNot(
  ruleInstanceId: string,
  timestamp: number,
  ruleHit: boolean
) {
  return getTestTransaction({
    timestamp,
    executedRules: [
      {
        ruleInstanceId,
        ruleName: '',
        ruleDescription: '',
        ruleAction: ruleHit ? 'FLAG' : 'ALLOW',
        ruleHit,
        ruleHitMeta: { hitDirections: ['ORIGIN', 'DESTINATION'] },
      },
    ],
    hitRules: ruleHit
      ? [
          {
            ruleInstanceId,
            ruleName: '',
            ruleDescription: '',
            ruleAction: ruleHit ? 'FLAG' : 'ALLOW',
            ruleHitMeta: { hitDirections: ['ORIGIN', 'DESTINATION'] },
          },
        ]
      : [],
  })
}

function getTestUserHitOrNot(
  ruleInstanceId: string,
  createdTimestamp: number,
  ruleHit: boolean
) {
  return getTestUser({
    createdTimestamp,
    executedRules: [
      {
        ruleInstanceId,
        executedAt: createdTimestamp,
        ruleName: '',
        ruleDescription: '',
        ruleAction: ruleHit ? 'FLAG' : 'ALLOW',
        ruleHit,
        ruleHitMeta: { hitDirections: ['ORIGIN', 'DESTINATION'] },
      },
    ],
    hitRules: ruleHit
      ? [
          {
            ruleInstanceId,
            executedAt: createdTimestamp,
            ruleName: '',
            ruleDescription: '',
            ruleAction: ruleHit ? 'FLAG' : 'ALLOW',
            ruleHitMeta: { hitDirections: ['ORIGIN', 'DESTINATION'] },
          },
        ]
      : [],
  })
}

dynamoDbSetupHook()
enableLocalChangeHandler()
withFeatureHook(['RULES_ENGINE_V8'])

describe('RuleInstanceService', () => {
  describe('getRuleInstanceStats', () => {
    const tenantId = getTestTenantId()
    const now = dayjs()
    const transactionRuleInstance = getTestRuleInstance({
      type: 'TRANSACTION',
      id: 'TEST-RULE-INSTANCE-1',
      logic: { and: [true] },
    })
    const userRuleInstance = getTestRuleInstance({
      type: 'USER',
      id: 'TEST-RULE-INSTANCE-2',
      logic: { and: [true] },
    })
    let ruleInstanceService: RuleInstanceService

    beforeAll(async () => {
      const dynamoDb = getDynamoDbClient()
      const mongoDb = await getMongoDbClient()
      ruleInstanceService = new RuleInstanceService(tenantId, {
        dynamoDb,
        mongoDb,
      })
      await ruleInstanceService.createOrUpdateRuleInstance(
        transactionRuleInstance
      )
      await ruleInstanceService.createOrUpdateRuleInstance(userRuleInstance)
    })

    setUpUsersHooks(tenantId, [
      getTestUserHitOrNot(
        userRuleInstance.id as string,
        now.subtract(1, 'day').valueOf(),
        true
      ),
      getTestUserHitOrNot(
        userRuleInstance.id as string,
        now.subtract(1, 'day').valueOf(),
        false
      ),
      getTestUserHitOrNot(userRuleInstance.id as string, now.valueOf(), true),
      getTestUserHitOrNot(userRuleInstance.id as string, now.valueOf(), true),
      getTestUserHitOrNot(userRuleInstance.id as string, now.valueOf(), false),
    ])

    setUpTransactionsHooks(tenantId, [
      getTestTransactionHitOrNot(
        transactionRuleInstance.id as string,
        now.subtract(1, 'day').valueOf(),
        true
      ),
      getTestTransactionHitOrNot(
        transactionRuleInstance.id as string,
        now.subtract(1, 'day').valueOf(),
        false
      ),
      getTestTransactionHitOrNot(
        transactionRuleInstance.id as string,
        now.valueOf(),
        true
      ),
      getTestTransactionHitOrNot(
        transactionRuleInstance.id as string,
        now.valueOf(),
        true
      ),
      getTestTransactionHitOrNot(
        transactionRuleInstance.id as string,
        now.valueOf(),
        false
      ),
    ])

    it('transaction rule stats', async () => {
      const mongoDb = await getMongoDbClient()
      const dashboardRepo = new DashboardStatsRepository(tenantId, { mongoDb })
      await dashboardRepo.refreshTransactionStats()

      const result = await ruleInstanceService.getRuleInstanceStats(
        transactionRuleInstance.id as string,
        {
          afterTimestamp: now.subtract(2, 'day').valueOf(),
          beforeTimestamp: now.add(1, 'day').valueOf(),
        }
      )
      expect(result).toEqual({
        transactionsHit: 3,
        usersHit: 2,
        alertsHit: 2,
        executionStats: [
          {
            date: now.subtract(2, 'day').format('YYYY-MM-DD'),
            runCount: 0,
            hitCount: 0,
          },
          {
            date: now.subtract(1, 'day').format('YYYY-MM-DD'),
            runCount: 2,
            hitCount: 1,
          },
          {
            date: now.format('YYYY-MM-DD'),
            runCount: 3,
            hitCount: 2,
          },
          {
            date: now.add(1, 'day').format('YYYY-MM-DD'),
            runCount: 0,
            hitCount: 0,
          },
        ],
        ruleInstanceUpdateStats: [],
        alertsStats: [
          {
            alertsCreated: 0,
            date: now.subtract(2, 'day').format('YYYY-MM-DD'),
            falsePositiveAlerts: 0,
          },
          {
            alertsCreated: 0,
            date: now.subtract(1, 'day').format('YYYY-MM-DD'),
            falsePositiveAlerts: 0,
          },
          {
            alertsCreated: 2,
            date: now.format('YYYY-MM-DD'),
            falsePositiveAlerts: 0,
          },
          {
            alertsCreated: 0,
            date: now.add(1, 'day').format('YYYY-MM-DD'),
            falsePositiveAlerts: 0,
          },
        ],
      })
    })
    it('user rule stats', async () => {
      const result = await ruleInstanceService.getRuleInstanceStats(
        userRuleInstance.id as string,
        {
          afterTimestamp: now.subtract(2, 'day').valueOf(),
          beforeTimestamp: now.add(1, 'day').valueOf(),
        }
      )
      expect(result).toEqual({
        usersHit: 3,
        alertsHit: 3,
        executionStats: [
          {
            date: now.subtract(2, 'day').format('YYYY-MM-DD'),
            runCount: 0,
            hitCount: 0,
          },
          {
            date: now.subtract(1, 'day').format('YYYY-MM-DD'),
            runCount: 2,
            hitCount: 1,
          },
          {
            date: now.format('YYYY-MM-DD'),
            runCount: 3,
            hitCount: 2,
          },
          {
            date: now.add(1, 'day').format('YYYY-MM-DD'),
            runCount: 0,
            hitCount: 0,
          },
        ],
        alertsStats: [
          {
            alertsCreated: 0,
            date: now.subtract(2, 'day').format('YYYY-MM-DD'),
            falsePositiveAlerts: 0,
          },
          {
            alertsCreated: 0,
            date: now.subtract(1, 'day').format('YYYY-MM-DD'),
            falsePositiveAlerts: 0,
          },
          {
            alertsCreated: 3,
            date: now.format('YYYY-MM-DD'),
            falsePositiveAlerts: 0,
          },
          {
            alertsCreated: 0,
            date: now.add(1, 'day').format('YYYY-MM-DD'),
            falsePositiveAlerts: 0,
          },
        ],
        ruleInstanceUpdateStats: [],
      })
    })
  })
})
