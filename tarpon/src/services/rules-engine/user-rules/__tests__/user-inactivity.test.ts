import { UserInactivityRuleParameters } from '../user-inactivity'
import { dynamoDbSetupHook } from '@/test-utils/dynamodb-test-utils'
import {
  UserRuleTestCase,
  createUserRuleTestCase,
  setUpRulesHooks,
} from '@/test-utils/rule-test-utils'
import { getTestTenantId } from '@/test-utils/tenant-test-utils'
import {
  getTestTransaction,
  setUpTransactionsHooks,
} from '@/test-utils/transaction-test-utils'
import dayjs from '@/utils/dayjs'
import { getTestUser } from '@/test-utils/user-test-utils'
import { withLocalChangeHandler } from '@/utils/local-dynamodb-change-handler'

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

    describe.each<UserRuleTestCase>([
      {
        name: 'User has no transactions',
        users: [getTestUser({ userId: 'U-1' })],
        expectetRuleHitMetadata: [
          { hitDirections: ['ORIGIN'], isOngoingScreeningHit: true },
        ],
      },
    ])('User inactivity rule', ({ name, users, expectetRuleHitMetadata }) => {
      createUserRuleTestCase(
        name,
        TEST_TENANT_ID,
        users,
        expectetRuleHitMetadata,
        undefined,
        true
      )
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

    describe.each<UserRuleTestCase>([
      {
        name: 'User has a transaction within the inactivity period',
        users: [getTestUser({ userId: 'U-1' })],
        expectetRuleHitMetadata: [],
      },
    ])('User inactivity rule', ({ name, users, expectetRuleHitMetadata }) => {
      createUserRuleTestCase(
        name,
        TEST_TENANT_ID,
        users,
        expectetRuleHitMetadata,
        undefined,
        true
      )
    })
  })
})
