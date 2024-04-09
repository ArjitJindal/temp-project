import { UserInactivityRuleParameters } from '../user-inactivity'
import { dynamoDbSetupHook } from '@/test-utils/dynamodb-test-utils'
import {
  AllUserRuleTestCase,
  createAllUserRuleTestCases,
  setUpRulesHooks,
} from '@/test-utils/rule-test-utils'
import { getTestTenantId } from '@/test-utils/tenant-test-utils'
import {
  getTestTransaction,
  setUpTransactionsHooks,
} from '@/test-utils/transaction-test-utils'
import dayjs from '@/utils/dayjs'
import { getTestUser, setUpUsersHooks } from '@/test-utils/user-test-utils'
import { withLocalChangeHandler } from '@/utils/local-dynamodb-change-handler'
import { withFeatureHook } from '@/test-utils/feature-test-utils'
import { RISK_LEVELS } from '@/@types/openapi-public-custom/RiskLevel'
import { RiskLevel } from '@/@types/openapi-internal/RiskLevel'
import { RiskScoringService } from '@/services/risk-scoring'

withLocalChangeHandler()
dynamoDbSetupHook()

describe('Core logic', () => {
  const TEST_TENANT_ID = getTestTenantId()

  setUpRulesHooks(TEST_TENANT_ID, [
    {
      id: 'R-33',
      defaultParameters: {
        checkDirection: 'all',
        inactivityDays: 30,
      } as UserInactivityRuleParameters,
      type: 'USER_ONGOING_SCREENING',
    },
  ])

  describe('User inactivity rule: Hit', () => {
    const userId1 = 'U-1'
    const userId2 = 'U-2'

    setUpTransactionsHooks(TEST_TENANT_ID, [
      getTestTransaction({
        timestamp: dayjs().subtract(31, 'days').valueOf(),
        originUserId: userId1,
        destinationUserId: userId2,
      }),
    ])

    describe.each<AllUserRuleTestCase>([
      {
        name: 'User has no transactions',
        users: [getTestUser({ userId: userId1 })],
        expectedHits: [true],
      },
    ])('User inactivity rule', (testCase) => {
      createAllUserRuleTestCases(TEST_TENANT_ID, testCase)
    })
  })

  describe('User inactivity rule: Miss', () => {
    const userId1 = 'U-1'
    const userId2 = 'U-2'

    setUpTransactionsHooks(TEST_TENANT_ID, [
      getTestTransaction({
        timestamp: dayjs().subtract(29, 'days').valueOf(),
        originUserId: userId1,
        destinationUserId: userId2,
      }),
    ])

    describe.each<AllUserRuleTestCase>([
      {
        name: 'User has a transaction within the inactivity period',
        users: [getTestUser({ userId: 'U-1' })],
        expectedHits: [false],
      },
    ])('User inactivity rule', (testCase) => {
      createAllUserRuleTestCases(TEST_TENANT_ID, testCase)
    })
  })
})

describe('User inactivity with Risk Level', () => {
  withFeatureHook(['RISK_LEVELS', 'RISK_SCORING'])
  const TEST_TENANT_ID = getTestTenantId()
  const params = {
    checkDirection: 'all',
    inactivityDays: 30,
  } as UserInactivityRuleParameters

  jest
    .spyOn(RiskScoringService.prototype, 'updateInitialRiskScores')
    .mockReturnValue(Promise.resolve(30))

  setUpUsersHooks(TEST_TENANT_ID, [
    getTestUser({
      userId: 'U-1',
      drsScore: {
        manualRiskLevel: 'LOW',
        drsScore: 30,
        createdAt: dayjs().valueOf(),
        isUpdatable: false,
      },
    }),
  ])

  setUpRulesHooks(TEST_TENANT_ID, [
    {
      id: 'R-33',
      defaultParameters: params,
      defaultRiskLevelParameters: RISK_LEVELS.reduce((acc, riskLevel) => {
        acc[riskLevel] = params
        return acc
      }, {} as Record<RiskLevel, UserInactivityRuleParameters>),
      type: 'USER_ONGOING_SCREENING',
    },
  ])

  describe('User inactivity rule: Hit', () => {
    const userId1 = 'U-1'
    const userId2 = 'U-2'

    setUpTransactionsHooks(TEST_TENANT_ID, [
      getTestTransaction({
        timestamp: dayjs().subtract(31, 'days').valueOf(),
        originUserId: userId1,
        destinationUserId: userId2,
      }),
    ])

    describe.each<AllUserRuleTestCase>([
      {
        name: 'User has no transactions',
        users: [getTestUser({ userId: userId1 })],
        expectedHits: [true],
      },
    ])('User inactivity rule', (testCase) => {
      createAllUserRuleTestCases(TEST_TENANT_ID, testCase)
    })
  })
})
