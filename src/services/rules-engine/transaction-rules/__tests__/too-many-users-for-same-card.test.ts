import dayjs from 'dayjs'
import { TooManyUsersForSameCardParameters } from '../too-many-users-for-same-card'
import { getTestTenantId } from '@/test-utils/tenant-test-utils'
import { getTestTransaction } from '@/test-utils/transaction-test-utils'
import {
  setUpRulesHooks,
  createTransactionRuleTestCase,
  TransactionRuleTestCase,
} from '@/test-utils/rule-test-utils'
import { dynamoDbSetupHook } from '@/test-utils/dynamodb-test-utils'

const TEST_TENANT_ID = getTestTenantId()

dynamoDbSetupHook()

setUpRulesHooks(TEST_TENANT_ID, [
  {
    type: 'TRANSACTION',
    ruleImplementationName: 'too-many-users-for-same-card',
    defaultParameters: {
      uniqueUsersCountThreshold: 1,
      timeWindowInDays: 1,
    } as TooManyUsersForSameCardParameters,
    defaultAction: 'FLAG',
  },
])

describe.each<TransactionRuleTestCase>([
  {
    name: 'Different users using the same card in short time - hit',
    transactions: [
      getTestTransaction({
        originUserId: '1',
        timestamp: dayjs('2022-01-01T00:00:00.000Z').valueOf(),
        originPaymentDetails: {
          method: 'CARD',
          cardFingerprint: '123',
        },
      }),
      getTestTransaction({
        originUserId: '2',
        timestamp: dayjs('2022-01-01T06:00:00.000Z').valueOf(),
        originPaymentDetails: {
          method: 'CARD',
          cardFingerprint: '123',
        },
      }),
    ],
    expectedHits: [false, true],
  },
  {
    name: 'Different users using the same card not in short time - not hit',
    transactions: [
      getTestTransaction({
        originUserId: '1',
        timestamp: dayjs('2022-01-01T00:00:00.000Z').valueOf(),
        originPaymentDetails: {
          method: 'CARD',
          cardFingerprint: '123',
        },
      }),
      getTestTransaction({
        originUserId: '2',
        timestamp: dayjs('2022-01-06T00:00:00.000Z').valueOf(),
        originPaymentDetails: {
          method: 'CARD',
          cardFingerprint: '123',
        },
      }),
    ],
    expectedHits: [false, false],
  },
  {
    name: 'Different users using the different card - not hit',
    transactions: [
      getTestTransaction({
        originUserId: '1',
        timestamp: dayjs('2022-01-01T00:00:00.000Z').valueOf(),
        originPaymentDetails: {
          method: 'CARD',
          cardFingerprint: '123',
        },
      }),
      getTestTransaction({
        originUserId: '2',
        timestamp: dayjs('2022-01-01T00:00:00.000Z').valueOf(),
        originPaymentDetails: {
          method: 'CARD',
          cardFingerprint: '456',
        },
      }),
    ],
    expectedHits: [false, false],
  },
  {
    name: 'Same users using the same card - not hit',
    transactions: [
      getTestTransaction({
        originUserId: '1',
        timestamp: dayjs('2022-01-01T00:00:00.000Z').valueOf(),
        originPaymentDetails: {
          method: 'CARD',
          cardFingerprint: '123',
        },
      }),
      getTestTransaction({
        originUserId: '1',
        timestamp: dayjs('2022-01-01T00:00:00.000Z').valueOf(),
        originPaymentDetails: {
          method: 'CARD',
          cardFingerprint: '123',
        },
      }),
    ],
    expectedHits: [false, false],
  },
])('', ({ name, transactions, expectedHits }) => {
  createTransactionRuleTestCase(
    name,
    TEST_TENANT_ID,
    transactions,
    expectedHits
  )
})
