import {
  extractFirstAndLastName,
  PaymentMethodNameRuleParameter,
} from '../payment-method-name-levensthein-distance'
import { getRuleByRuleId } from '../library'
import { getTestTenantId } from '@/test-utils/tenant-test-utils'
import { getTestTransaction } from '@/test-utils/transaction-test-utils'
import {
  setUpRulesHooks,
  createTransactionRuleTestCase,
  TransactionRuleTestCase,
  testRuleDescriptionFormatting,
  ruleVariantsTest,
} from '@/test-utils/rule-test-utils'
import { dynamoDbSetupHook } from '@/test-utils/dynamodb-test-utils'
import {
  getTestBusiness,
  getTestUser,
  setUpUsersHooks,
} from '@/test-utils/user-test-utils'

dynamoDbSetupHook()

const TEST_TENANT_ID = getTestTenantId()

setUpUsersHooks(TEST_TENANT_ID, [
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
  getTestBusiness({
    userId: '2-1',
    legalEntity: {
      companyGeneralDetails: {
        legalName: 'Ankita Gupta',
      },
    },
  }),
  getTestUser({
    userId: '4-1',
    userDetails: {
      name: {
        firstName: 'John',
        middleName: 'David',
        lastName: 'Smith',
      },
    },
  }),
])

ruleVariantsTest({ aggregation: false, v8: true }, () => {
  describe('Hit on empty `name', () => {
    setUpRulesHooks(TEST_TENANT_ID, [
      {
        type: 'TRANSACTION',
        ruleImplementationName: 'payment-method-name-levensthein-distance',
        defaultParameters: {
          allowedDistancePercentage: 10,
        } as PaymentMethodNameRuleParameter,
      },
    ])
    describe.each<TransactionRuleTestCase>([
      {
        name: 'Empty name causes a hit',
        transactions: [
          getTestTransaction({
            originUserId: '2-1',
            originPaymentDetails: {
              method: 'CARD',
              nameOnCard: {
                firstName: '',
                middleName: '',
                lastName: '',
              },
            },
          }),
        ],
        expectedHits: [true],
      },
    ])('', ({ name, transactions, expectedHits }) => {
      createTransactionRuleTestCase(
        name,
        TEST_TENANT_ID,
        transactions,
        expectedHits,
        undefined,
        { autoCreateUser: false }
      )
    })
  })

  describe('No hit on 25%', () => {
    setUpRulesHooks(TEST_TENANT_ID, [
      {
        type: 'TRANSACTION',
        ruleImplementationName: 'payment-method-name-levensthein-distance',
        defaultParameters: {
          allowedDistancePercentage: 25,
          ignoreEmptyName: true,
        } as PaymentMethodNameRuleParameter,
      },
    ])

    describe.each<TransactionRuleTestCase>([
      {
        name: 'Name matches and is under allowed distance - not hit',
        transactions: [
          getTestTransaction({
            originUserId: '4-1',
            originPaymentDetails: {
              method: 'GENERIC_BANK_ACCOUNT',
              name: 'Mr John David Smith',
            },
          }),
          getTestTransaction({
            originUserId: '4-1',
            originPaymentDetails: {
              method: 'GENERIC_BANK_ACCOUNT',
              name: 'Mr. John David Smith',
            },
          }),
          getTestTransaction({
            originUserId: '4-1',
            originPaymentDetails: {
              method: 'GENERIC_BANK_ACCOUNT',
              name: 'Mr. John David Smith',
            },
          }),
          getTestTransaction({
            originUserId: '4-1',
            originPaymentDetails: {
              method: 'GENERIC_BANK_ACCOUNT',
              name: 'Barry John David Smith',
            },
          }),
        ],
        expectedHits: [false, false, false, true],
      },
    ])('Bank payment', ({ name, transactions, expectedHits }) => {
      createTransactionRuleTestCase(
        name,
        TEST_TENANT_ID,
        transactions,
        expectedHits,
        undefined,
        { autoCreateUser: false }
      )
    })
  })

  describe('No hits on empty name', () => {
    setUpRulesHooks(TEST_TENANT_ID, [
      {
        type: 'TRANSACTION',
        ruleImplementationName: 'payment-method-name-levensthein-distance',
        defaultParameters: {
          allowedDistancePercentage: 10,
          ignoreEmptyName: true,
        } as PaymentMethodNameRuleParameter,
      },
    ])

    describe('R-118 description formatting', () => {
      testRuleDescriptionFormatting(
        'first',
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
          descriptionTemplate: getRuleByRuleId('R-118').descriptionTemplate,
        },
        [
          'Sender’s name does not match name on sender’s payment method (**1111).',
          'Sender’s name does not match name on sender’s payment method (**2222).',
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
      {
        name: 'Empty name doesnot cause a hit',
        transactions: [
          getTestTransaction({
            originUserId: '2-1',
            originPaymentDetails: {
              method: 'CARD',
              nameOnCard: {
                firstName: '',
                middleName: '',
                lastName: '',
              },
            },
          }),
        ],
        expectedHits: [false],
      },
    ])('Card payment', ({ name, transactions, expectedHits }) => {
      createTransactionRuleTestCase(
        name,
        TEST_TENANT_ID,
        transactions,
        expectedHits,
        undefined,
        { autoCreateUser: false }
      )
    })

    describe.each<TransactionRuleTestCase>([
      {
        name: 'Name matches and is under allowed distance - not hit',
        transactions: [
          getTestTransaction({
            originUserId: '1-1',
            originPaymentDetails: {
              method: 'GENERIC_BANK_ACCOUNT',
              name: 'Baran Realblood Ozkan',
            },
          }),
          getTestTransaction({
            originUserId: '1-1',
            originPaymentDetails: {
              method: 'GENERIC_BANK_ACCOUNT',
              name: 'Brran Realblood Ozkan',
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
              method: 'GENERIC_BANK_ACCOUNT',
              name: 'Baran Realblood Ozkan',
            },
          }),
          getTestTransaction({
            originUserId: '2-1',
            originPaymentDetails: {
              method: 'GENERIC_BANK_ACCOUNT',
              name: 'Anikta Gupta',
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
              method: 'GENERIC_BANK_ACCOUNT',
              name: 'Baran Realblood Ozkan',
            },
          }),
          getTestTransaction({
            originUserId: '1-1',
            originPaymentDetails: {
              method: 'GENERIC_BANK_ACCOUNT',
              name: 'Baran Rlood Ozkan',
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
              method: 'GENERIC_BANK_ACCOUNT',
              name: 'Baran Realblood Ozkan',
            },
          }),
          getTestTransaction({
            originUserId: '3-1',
            originPaymentDetails: {
              method: 'GENERIC_BANK_ACCOUNT',
              name: 'Ankita Gupta',
            },
          }),
        ],
        expectedHits: [false, false],
      },
    ])('Bank payment', ({ name, transactions, expectedHits }) => {
      createTransactionRuleTestCase(
        name,
        TEST_TENANT_ID,
        transactions,
        expectedHits,
        undefined,
        { autoCreateUser: false }
      )
    })
  })
})

test('extract first and last names', () => {
  const testCases: [string, string][] = [
    ['Baran Realblood Oskan', 'Baran Oskan'],
    ['Tim  Coulson', 'Tim Coulson'],
    ['John', 'John'],
  ]

  testCases.forEach((tc) => {
    expect(extractFirstAndLastName(tc[0])).toEqual(tc[1])
  })
})
