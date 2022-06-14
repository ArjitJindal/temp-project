import { MerchantReceiverNameRuleParameters } from '../merchant-receiver-name'
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
    ruleImplementationName: 'merchant-receiver-name',
    defaultParameters: {
      merchantNames: ['Mobikwik', 'Aeronpay'],
    } as MerchantReceiverNameRuleParameters,
    defaultAction: 'FLAG',
  },
])

describe.each<TransactionRuleTestCase>([
  {
    name: 'Merchant name is not same as Receiver name - not hit',
    transactions: [
      getTestTransaction({
        destinationPaymentDetails: {
          method: 'WALLET',
          name: 'GooglePay',
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
          name: undefined,
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
          name: 'Mobikwik',
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
