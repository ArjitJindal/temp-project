import { BlacklistPaymentdetailsRuleParameters } from '../blacklist-payment-details'
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

const TEST_TENANT_ID = getTestTenantId()

dynamoDbSetupHook()

setUpRulesHooks(TEST_TENANT_ID, [
  {
    type: 'TRANSACTION',
    ruleImplementationName: 'blacklist-payment-details',
    defaultParameters: {
      blacklistedIBANPaymentDetails: ['TR1234567890'],
      blacklistedGenericBankAccountPaymentDetails: ['1234567890'],
      blacklistedCardPaymentDetails: [
        {
          cardFingerprint: '1234567890',
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

ruleVariantsTest({ aggregation: false, v8: true }, () => {
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
      name: 'Card fingerprint details are in blacklist - hit',
      transactions: [
        getTestTransaction({
          originPaymentDetails: {
            method: 'CARD',
            cardFingerprint: '1234567890',
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
    {
      name: 'Bank account details are in blacklist - hit',
      transactions: [
        getTestTransaction({
          originPaymentDetails: {
            method: 'GENERIC_BANK_ACCOUNT',
            accountNumber: '1234567890',
          },
        }),
      ],
      expectedHits: [true],
    },
    {
      name: 'Bank account details are not in blacklist - not hit',
      transactions: [
        getTestTransaction({
          originPaymentDetails: {
            method: 'GENERIC_BANK_ACCOUNT',
            accountNumber: '1234567891',
          },
        }),
      ],
      expectedHits: [false],
    },
    {
      name: 'IBAN details are in blacklist - hit',
      transactions: [
        getTestTransaction({
          originPaymentDetails: {
            method: 'IBAN',
            IBAN: 'TR1234567890',
          },
        }),
      ],
      expectedHits: [true],
    },
    {
      name: 'IBAN details are not in blacklist - not hit',
      transactions: [
        getTestTransaction({
          originPaymentDetails: {
            method: 'IBAN',
            IBAN: 'TR1234567891',
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
})
