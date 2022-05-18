import dayjs from 'dayjs'
import { MultipleSendersWithinTimePeriodRuleParameters } from '../multiple-senders-within-time-period-base'
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
    ruleImplementationName: 'multiple-counterparty-senders-within-time-period',
    defaultParameters: {
      sendersCount: 2,
      timePeriodDays: 30,
    } as MultipleSendersWithinTimePeriodRuleParameters,
    defaultAction: 'FLAG',
  },
])

describe.each<TransactionRuleTestCase>([
  {
    name: 'Transacting with different originUserID (within time period) - not hit',
    transactions: [
      getTestTransaction({
        originUserId: undefined,
        destinationUserId: '1-2',
        timestamp: dayjs('2022-01-01T00:00:00.000Z').valueOf(),
        originPaymentDetails: {
          method: 'CARD',
          cardFingerprint: '20ac00fed8ef913aefb17cfae1097cce',
          cardIssuedCountry: 'US',
          transactionReferenceField: 'Deposit',
          _3dsDone: true,
        },
      }),
      getTestTransaction({
        originUserId: undefined,
        destinationUserId: '1-3',
        timestamp: dayjs('2022-01-03T00:00:00.000Z').valueOf(),
        originPaymentDetails: {
          method: 'CARD',
          cardFingerprint: 'b5fe350d5135ab64a8f3c1097fadefd9effb',
          cardIssuedCountry: 'US',
          transactionReferenceField: 'Deposit',
          _3dsDone: true,
        },
      }),
      getTestTransaction({
        originUserId: undefined,
        destinationUserId: '1-4',
        timestamp: dayjs('2022-01-04T00:00:00.000Z').valueOf(),
        originPaymentDetails: {
          method: 'CARD',
          cardFingerprint: '18ac00fed8ef913aefb17cfae1097cce',
          cardIssuedCountry: 'US',
          transactionReferenceField: 'Deposit',
          _3dsDone: true,
        },
      }),
    ],
    expectedActions: ['ALLOW', 'ALLOW', 'ALLOW'],
  },
  {
    name: 'Transacting with different originUserID (not within time period) - not hit',
    transactions: [
      getTestTransaction({
        originUserId: undefined,
        destinationUserId: '2-1',
        timestamp: dayjs('2022-01-01T00:00:00.000Z').valueOf(),
        originPaymentDetails: {
          method: 'CARD',
          cardFingerprint: '12fc00fed8ef913aefb17cfae1097cce',
          cardIssuedCountry: 'GB',
          transactionReferenceField: 'Deposit',
          _3dsDone: true,
        },
      }),
      getTestTransaction({
        originUserId: undefined,
        destinationUserId: '2-2',
        timestamp: dayjs('2022-01-02T00:00:00.000Z').valueOf(),
        originPaymentDetails: {
          method: 'CARD',
          cardFingerprint: '12fc00fed8ef913aefb17cfae1097cce',
          cardIssuedCountry: 'GB',
          transactionReferenceField: 'Deposit',
          _3dsDone: true,
        },
      }),
      getTestTransaction({
        originUserId: undefined,
        destinationUserId: '2-3',
        timestamp: dayjs('2022-03-03T00:00:00.000Z').valueOf(),
        originPaymentDetails: {
          method: 'CARD',
          cardFingerprint: '12fc00fed8ef913aefb17cfae1097cce',
          cardIssuedCountry: 'GB',
          transactionReferenceField: 'Deposit',
          _3dsDone: true,
        },
      }),
    ],
    expectedActions: ['ALLOW', 'ALLOW', 'ALLOW'],
  },
  {
    name: 'Transacting with same originUserID (not within time period) - not hit',
    transactions: [
      getTestTransaction({
        originUserId: undefined,
        destinationUserId: '3-2',
        timestamp: dayjs('2022-01-01T00:00:00.000Z').valueOf(),
        originPaymentDetails: {
          method: 'CARD',
          cardFingerprint: '11ac00fed8ef913aefb17cfae1097cce',
          cardIssuedCountry: 'TR',
          transactionReferenceField: 'Deposit',
          _3dsDone: true,
        },
      }),
      getTestTransaction({
        originUserId: undefined,
        destinationUserId: '3-2',
        timestamp: dayjs('2022-01-03T00:00:00.000Z').valueOf(),
        originPaymentDetails: {
          method: 'CARD',
          cardFingerprint: '20ac99fed8ef913aefb17cfae1097cce',
          cardIssuedCountry: 'TR',
          transactionReferenceField: 'Deposit',
          _3dsDone: true,
        },
      }),
      getTestTransaction({
        originUserId: undefined,
        destinationUserId: '3-2',
        timestamp: dayjs('2022-02-29T00:00:00.000Z').valueOf(),
        originPaymentDetails: {
          method: 'CARD',
          cardFingerprint: '20ac00feg7ef913aefb17cfae1097cce',
          cardIssuedCountry: 'TR',
          transactionReferenceField: 'Deposit',
          _3dsDone: true,
        },
      }),
    ],
    expectedActions: ['ALLOW', 'ALLOW', 'ALLOW'],
  },
  {
    name: 'Transacting with same originUserID (within time period) - hit',
    transactions: [
      getTestTransaction({
        originUserId: undefined,
        destinationUserId: '4-2',
        timestamp: dayjs('2022-01-01T00:00:00.000Z').valueOf(),
        originPaymentDetails: {
          method: 'CARD',
          cardFingerprint: '20ac00fegf3ef913aefb17cfae1097cce',
          cardIssuedCountry: 'CH',
          transactionReferenceField: 'Deposit',
          _3dsDone: true,
        },
      }),
      getTestTransaction({
        originUserId: undefined,
        destinationUserId: '4-2',
        timestamp: dayjs('2022-01-03T00:00:00.000Z').valueOf(),
        originPaymentDetails: {
          method: 'CARD',
          cardFingerprint: '34gf00fed8ef913aefb17cfae1097cce',
          cardIssuedCountry: 'CH',
          transactionReferenceField: 'Deposit',
          _3dsDone: true,
        },
      }),
      getTestTransaction({
        originUserId: undefined,
        destinationUserId: '4-2',
        timestamp: dayjs('2022-01-04T00:00:00.000Z').valueOf(),
        originPaymentDetails: {
          method: 'CARD',
          cardFingerprint: '98ju00fed8ef913aefb17cfae1097cce',
          cardIssuedCountry: 'CH',
          transactionReferenceField: 'Deposit',
          _3dsDone: true,
        },
      }),
    ],
    expectedActions: ['ALLOW', 'ALLOW', 'FLAG'],
  },
])('', ({ name, transactions, expectedActions }) => {
  createTransactionRuleTestCase(
    name,
    TEST_TENANT_ID,
    transactions,
    expectedActions
  )
})
