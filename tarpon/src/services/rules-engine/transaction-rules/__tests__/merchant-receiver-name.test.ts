import { MerchantReceiverNameRuleParameters } from '../merchant-receiver-name'
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

dynamoDbSetupHook()

ruleVariantsTest({ v8: true, aggregation: false }, () => {
  const TEST_TENANT_ID = getTestTenantId()

  setUpRulesHooks(TEST_TENANT_ID, [
    {
      type: 'TRANSACTION',
      ruleImplementationName: 'merchant-receiver-name',
      defaultParameters: {
        merchantNames: ['Mobikwik', 'Aeronpay'],
      } as MerchantReceiverNameRuleParameters,
      defaultAction: 'FLAG',
    },
  ])

  describe('R-13 description formatting', () => {
    testRuleDescriptionFormatting(
      'basic case',
      TEST_TENANT_ID,
      [
        getTestTransaction({
          destinationPaymentDetails: {
            method: 'WALLET',
            name: 'Mobikwik',
            walletType: 'wallet',
          },
        }),
      ],
      {
        descriptionTemplate: getRuleByRuleId('R-13').descriptionTemplate,
      },
      ['Mobikwik is blacklisted.']
    )
  })

  describe.each<TransactionRuleTestCase>([
    {
      name: 'Merchant name is not same as Receiver name - not hit',
      transactions: [
        getTestTransaction({
          destinationPaymentDetails: {
            method: 'WALLET',
            name: 'GooglePay',
            walletType: 'wallet',
          },
        }),
      ],
      expectedHits: [false],
    },
    {
      name: 'Merchant name is same as Receiver name - hit',
      transactions: [
        getTestTransaction({
          destinationPaymentDetails: {
            method: 'WALLET',
            name: 'Mobikwik',
            walletType: 'wallet',
          },
        }),
      ],
      expectedHits: [true],
    },
    {
      name: 'Receiver name substring present in Merchant name - hit',
      transactions: [
        getTestTransaction({
          destinationPaymentDetails: {
            method: 'WALLET',
            name: 'Mobikwik-BNPL',
            walletType: 'wallet',
          },
        }),
      ],
      expectedHits: [true],
    },
    {
      name: 'Receiver name is undefined - not hit',
      transactions: [
        getTestTransaction({
          destinationPaymentDetails: {
            method: 'WALLET',
            name: 'test',
            walletType: 'wallet',
          },
        }),
      ],
      expectedHits: [false],
    },
    {
      name: 'Payment type is not WALLET - not hit',
      transactions: [
        getTestTransaction({
          destinationPaymentDetails: {
            method: 'CARD',
            cardFingerprint: 'Mobikwik',
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
