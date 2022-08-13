import { CardHolderNameRuleParameter } from '../card-holder-name-levensthein-distance'
import { getTestTenantId } from '@/test-utils/tenant-test-utils'
import { getTestTransaction } from '@/test-utils/transaction-test-utils'
import {
  setUpRulesHooks,
  createTransactionRuleTestCase,
  TransactionRuleTestCase,
  testRuleDescriptionFormatting,
} from '@/test-utils/rule-test-utils'
import { dynamoDbSetupHook } from '@/test-utils/dynamodb-test-utils'
import {
  getTestUser,
  setUpConsumerUsersHooks,
} from '@/test-utils/user-test-utils'

dynamoDbSetupHook()

const TEST_TENANT_ID = getTestTenantId()

setUpRulesHooks(TEST_TENANT_ID, [
  {
    type: 'TRANSACTION',
    ruleImplementationName: 'card-holder-name-levensthein-distance',
    defaultParameters: {
      allowedDistance: 1,
    } as CardHolderNameRuleParameter,
  },
])

setUpConsumerUsersHooks(TEST_TENANT_ID, [
  getTestUser({
    userId: '1-1',
    userDetails: {
      name: {
        firstName: 'Baran',
        middleName: 'Realblood',
        lastName: 'Ozkan',
      },
    },
  }),
  getTestUser({
    userId: '2-1',
    userDetails: {
      name: {
        firstName: 'Ankita',
        lastName: 'Gupta',
      },
    },
  }),
])

describe('R-118 description formatting', () => {
  testRuleDescriptionFormatting(
    TEST_TENANT_ID,
    [
      getTestTransaction({
        originUserId: '2-1',
        originPaymentDetails: {
          method: 'CARD',
          nameOnCard: {
            firstName: 'Baran',
            middleName: 'Realblood',
            lastName: 'Ozkan',
          },
          cardFingerprint: '**1111',
        },
      }),
      getTestTransaction({
        originUserId: '2-1',
        originPaymentDetails: {
          method: 'CARD',
          nameOnCard: {
            firstName: 'Anikta',
            lastName: 'Gupta',
          },
          cardFingerprint: '**2222',
        },
      }),
    ],
    {
      descriptionTemplate: `{{ if-sender 'Sender’s' 'Receiver’s' }} name does not match name on {{ if-sender 'sender’s' 'receiver’s' }} card ({{ cardFingerprint }})`,
    },
    [
      'Sender’s name does not match name on sender’s card (**1111)',
      'Sender’s name does not match name on sender’s card (**2222)',
    ]
  )
})

describe.each<TransactionRuleTestCase>([
  {
    name: 'Name matches and is under allowed distance - not hit',
    transactions: [
      getTestTransaction({
        originUserId: '1-1',
        originPaymentDetails: {
          method: 'CARD',
          nameOnCard: {
            firstName: 'Baran',
            middleName: 'Realblood',
            lastName: 'Ozkan',
          },
        },
      }),
      getTestTransaction({
        originUserId: '1-1',
        originPaymentDetails: {
          method: 'CARD',
          nameOnCard: {
            firstName: 'Brran',
            middleName: 'Realblood',
            lastName: 'Ozkan',
          },
        },
      }),
    ],
    expectedHits: [false, false],
  },
  {
    name: 'Name on card doesnot match / is not under allowed distance - hit',
    transactions: [
      getTestTransaction({
        originUserId: '2-1',
        originPaymentDetails: {
          method: 'CARD',
          nameOnCard: {
            firstName: 'Baran',
            middleName: 'Realblood',
            lastName: 'Ozkan',
          },
        },
      }),
      getTestTransaction({
        originUserId: '2-1',
        originPaymentDetails: {
          method: 'CARD',
          nameOnCard: {
            firstName: 'Anikta',
            lastName: 'Gupta',
          },
        },
      }),
    ],
    expectedHits: [true, true],
  },
  {
    name: 'Middle name on card doesnot match - not hit',
    transactions: [
      getTestTransaction({
        originUserId: '1-1',
        originPaymentDetails: {
          method: 'CARD',
          nameOnCard: {
            firstName: 'Baran',
            middleName: 'Realblood',
            lastName: 'Ozkan',
          },
        },
      }),
      getTestTransaction({
        originUserId: '1-1',
        originPaymentDetails: {
          method: 'CARD',
          nameOnCard: {
            firstName: 'Baran',
            middleName: 'Rlood',
            lastName: 'Ozkan',
          },
        },
      }),
    ],
    expectedHits: [false, false],
  },
  {
    name: 'User Name not found with particular card name - not hit',
    transactions: [
      getTestTransaction({
        originUserId: '3-1',
        originPaymentDetails: {
          method: 'CARD',
          nameOnCard: {
            firstName: 'Baran',
            middleName: 'Realblood',
            lastName: 'Ozkan',
          },
        },
      }),
      getTestTransaction({
        originUserId: '3-1',
        originPaymentDetails: {
          method: 'CARD',
          nameOnCard: {
            firstName: 'Ankita',
            lastName: 'Gupta',
          },
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
