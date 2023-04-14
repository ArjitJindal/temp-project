import { v4 as uuidv4 } from 'uuid'
import { BlacklistPaymentdetailsRuleParameters } from '../blacklist-payment-details'
import { getRuleByRuleId } from '../library'
import { getTestTenantId } from '@/test-utils/tenant-test-utils'
import { getTestTransaction } from '@/test-utils/transaction-test-utils'
import {
  setUpRulesHooks,
  createTransactionRuleTestCase,
  TransactionRuleTestCase,
  testRuleDescriptionFormatting,
} from '@/test-utils/rule-test-utils'
import { dynamoDbSetupHook } from '@/test-utils/dynamodb-test-utils'

const TEST_TENANT_ID = getTestTenantId()

dynamoDbSetupHook()

setUpRulesHooks(TEST_TENANT_ID, [
  {
    type: 'TRANSACTION',
    ruleImplementationName: 'blacklist-payment-details',
    defaultParameters: {
      blacklistedCardPaymentDetails: [
        {
          cardFingerprint: uuidv4(),
          cardLast4Digits: '6564',
          cardExpiry: {
            month: 1,
            year: 1990,
          },
          nameOnCard: 'Baran Realblood Ozkan',
        },
      ],
    } as BlacklistPaymentdetailsRuleParameters,
    defaultAction: 'FLAG',
  },
])

describe('R-129 description formatting', () => {
  testRuleDescriptionFormatting(
    'basic case',
    TEST_TENANT_ID,
    [
      getTestTransaction({
        originPaymentDetails: {
          method: 'CARD',
          cardLast4Digits: '7664',
          cardExpiry: {
            month: 3,
            year: 1990,
          },
          nameOnCard: {
            firstName: 'Baran',
            middleName: 'Realblood',
            lastName: 'Ozzkan',
          },
        },
      }),
      getTestTransaction({
        originPaymentDetails: {
          method: 'CARD',
          cardLast4Digits: '6564',
          cardExpiry: {
            month: 1,
            year: 1990,
          },
          nameOnCard: {
            firstName: 'Baran',
            middleName: 'Realblood',
            lastName: 'Ozkan',
          },
        },
      }),
    ],
    {
      descriptionTemplate: getRuleByRuleId('R-129').descriptionTemplate,
    },
    [null, 'Sender’s payment details are in blacklisted payment details.']
  )
})

describe.each<TransactionRuleTestCase>([
  {
    name: 'Card payment details are in blacklist - hit',
    transactions: [
      getTestTransaction({
        originPaymentDetails: {
          method: 'CARD',
          cardLast4Digits: '6564',
          cardExpiry: {
            month: 1,
            year: 1990,
          },
          nameOnCard: {
            firstName: 'Baran',
            middleName: 'Realblood',
            lastName: 'Ozkan',
          },
        },
      }),
    ],
    expectedHits: [true],
  },
  {
    name: 'Card payment details are not in blacklist - not hit',
    transactions: [
      getTestTransaction({
        originPaymentDetails: {
          method: 'CARD',
          cardLast4Digits: '7664',
          cardExpiry: {
            month: 3,
            year: 1990,
          },
          nameOnCard: {
            firstName: 'Baran',
            middleName: 'Realblood',
            lastName: 'Ozzkan',
          },
        },
      }),
    ],
    expectedHits: [false],
  },
])('', ({ name, transactions, expectedHits }) => {
  createTransactionRuleTestCase(
    name,
    TEST_TENANT_ID,
    transactions,
    expectedHits
  )
})
