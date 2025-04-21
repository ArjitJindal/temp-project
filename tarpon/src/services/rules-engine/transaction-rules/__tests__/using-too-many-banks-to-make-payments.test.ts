import { v4 as uuidv4 } from 'uuid'
import { getRuleByRuleId } from '../library'
import { UsingTooManyBanksToMakePaymentsRuleParameters } from '../using-too-many-banks-to-make-payments'
import dayjs from '@/utils/dayjs'
import { getTestTenantId } from '@/test-utils/tenant-test-utils'
import {
  createTransactionRuleTestCase,
  ruleVariantsTest,
  setUpRulesHooks,
  testAggregationRebuild,
  testRuleDescriptionFormatting,
  TransactionRuleTestCase,
} from '@/test-utils/rule-test-utils'
import { dynamoDbSetupHook } from '@/test-utils/dynamodb-test-utils'
import { GenericBankAccountDetails } from '@/@types/openapi-public/GenericBankAccountDetails'
import { Transaction } from '@/@types/openapi-public/Transaction'
import { InternalTransaction } from '@/@types/openapi-internal/InternalTransaction'

const TEST_TRANSACTION_METHODS = [
  {
    method: 'GENERIC_BANK_ACCOUNT',
    bankName: 'US Bank',
  } as GenericBankAccountDetails,
  {
    method: 'GENERIC_BANK_ACCOUNT',
    bankName: 'Swiss Bank',
  } as GenericBankAccountDetails,
  {
    method: 'GENERIC_BANK_ACCOUNT',
    bankName: 'Central Bank of India',
  } as GenericBankAccountDetails,
  {
    method: 'GENERIC_BANK_ACCOUNT',
    bankName: 'US Federal Bank',
  } as GenericBankAccountDetails,

  {
    method: 'GENERIC_BANK_ACCOUNT',
    bankName: 'German National Bank',
  } as GenericBankAccountDetails,

  {
    method: 'GENERIC_BANK_ACCOUNT',
    bankName: 'Tasmanian Central Bank',
  } as GenericBankAccountDetails,
]
const DEFAULT_RULE_PARAMETERS: UsingTooManyBanksToMakePaymentsRuleParameters = {
  banksLimit: 2,
  timeWindow: {
    units: 5,
    granularity: 'hour',
  },
  checkSender: 'all',
  checkReceiver: 'all',
}

function getTestDifferentBankTransactions(
  transaction: Partial<Transaction | InternalTransaction> = {},
  sendingIndex: number,
  receivingIndex: number
): Transaction {
  return {
    transactionId: uuidv4(),
    type: 'TRANSFER',
    transactionState: 'SUCCESSFUL',
    originUserId: '8650a2611d0771cba03310f74bf6',
    destinationUserId: '9350a2611e0771cba03310f74bf6',
    originAmountDetails: {
      country: 'DE',
      transactionAmount: 800,
      transactionCurrency: 'EUR',
    },
    destinationAmountDetails: {
      country: 'IN',
      transactionAmount: 68351.34,
      transactionCurrency: 'INR',
    },
    promotionCodeUsed: true,
    timestamp: dayjs().valueOf(),
    originPaymentDetails: TEST_TRANSACTION_METHODS[sendingIndex],
    destinationPaymentDetails: TEST_TRANSACTION_METHODS[receivingIndex],
    ...transaction,
  }
}

dynamoDbSetupHook()

ruleVariantsTest({ aggregation: true, v8: true }, () => {
  describe('Description formatting', () => {
    const TEST_TENANT_ID = getTestTenantId()

    setUpRulesHooks(TEST_TENANT_ID, [
      {
        type: 'TRANSACTION',
        ruleImplementationName: 'using-too-many-banks-to-make-payments',
        defaultParameters: DEFAULT_RULE_PARAMETERS,
      },
    ])

    describe('R-15 description formatting', () => {
      testRuleDescriptionFormatting(
        'first',
        TEST_TENANT_ID,
        [
          getTestDifferentBankTransactions(
            {
              originUserId: '1-1',
              destinationUserId: '1-2',
              timestamp: dayjs('2022-01-01T00:00:00.000Z').valueOf(),
            },
            0,
            0
          ),
          getTestDifferentBankTransactions(
            {
              originUserId: '1-1',
              destinationUserId: '1-3',
              timestamp: dayjs('2022-01-01T01:00:00.000Z').valueOf(),
            },
            1,
            1
          ),
          getTestDifferentBankTransactions(
            {
              originUserId: '1-1',
              destinationUserId: '1-4',
              timestamp: dayjs('2022-01-01T02:00:00.000Z').valueOf(),
            },
            3,
            3
          ),
          getTestDifferentBankTransactions(
            {
              originUserId: '1-1',
              destinationUserId: '1-4',
              timestamp: dayjs('2022-01-01T03:00:00.000Z').valueOf(),
            },
            4,
            4
          ),
        ],
        {
          descriptionTemplate: getRuleByRuleId('R-15').descriptionTemplate,
        },
        [
          null,
          null,
          'Sender used 1 more bank(s) above the limit of 2 in 5 hours.',
          'Sender used 2 more bank(s) above the limit of 2 in 5 hours.',
        ]
      )
    })
  })

  describe('Core logic', () => {
    const TEST_TENANT_ID = getTestTenantId()

    setUpRulesHooks(TEST_TENANT_ID, [
      {
        type: 'TRANSACTION',
        ruleImplementationName: 'using-too-many-banks-to-make-payments',
        defaultParameters: DEFAULT_RULE_PARAMETERS,
      },
    ])

    describe.each<TransactionRuleTestCase>([
      {
        name: 'Too many sending banks - hit',
        transactions: [
          getTestDifferentBankTransactions(
            {
              originUserId: '1-1',
              destinationUserId: '1-2',
              timestamp: dayjs('2022-01-01T00:00:00.000Z').valueOf(),
            },
            0,
            0
          ),
          getTestDifferentBankTransactions(
            {
              originUserId: '1-1',
              destinationUserId: '1-3',
              timestamp: dayjs('2022-01-01T01:00:00.000Z').valueOf(),
            },
            1,
            0
          ),
          getTestDifferentBankTransactions(
            {
              originUserId: '1-1',
              destinationUserId: '1-4',
              timestamp: dayjs('2022-01-01T02:00:00.000Z').valueOf(),
            },
            2,
            0
          ),
        ],
        expectedHits: [false, false, true],
      },
      {
        name: 'Too many receiving banks - hit',
        transactions: [
          getTestDifferentBankTransactions(
            {
              originUserId: '2-2',
              destinationUserId: '2-1',
              timestamp: dayjs('2022-01-01T00:00:00.000Z').valueOf(),
            },
            0,
            0
          ),
          getTestDifferentBankTransactions(
            {
              originUserId: '2-3',
              destinationUserId: '2-1',
              timestamp: dayjs('2022-01-01T01:00:00.000Z').valueOf(),
            },
            0,
            1
          ),
          getTestDifferentBankTransactions(
            {
              originUserId: '2-4',
              destinationUserId: '2-1',
              timestamp: dayjs('2022-01-01T02:00:00.000Z').valueOf(),
            },
            0,
            2
          ),
        ],
        expectedHits: [false, false, true],
      },
      {
        name: 'Too frequent sending and receiving banks - hit',
        transactions: [
          getTestDifferentBankTransactions(
            {
              originUserId: '3-1',
              destinationUserId: '3-2',
              timestamp: dayjs('2022-01-01T00:00:00.000Z').valueOf(),
            },
            0,
            0
          ),
          getTestDifferentBankTransactions(
            {
              originUserId: '3-3',
              destinationUserId: '3-1',
              timestamp: dayjs('2022-01-01T01:00:00.000Z').valueOf(),
            },
            1,
            1
          ),
          getTestDifferentBankTransactions(
            {
              originUserId: '3-1',
              destinationUserId: '3-4',
              timestamp: dayjs('2022-01-01T02:00:00.000Z').valueOf(),
            },
            2,
            2
          ),
        ],
        expectedHits: [false, false, true],
      },
      {
        name: 'multiple banks used by different users - not hit',
        transactions: [
          getTestDifferentBankTransactions(
            {
              originUserId: '4-1',
              destinationUserId: '4-2',
              timestamp: dayjs('2022-01-01T00:00:00.000Z').valueOf(),
            },
            0,
            0
          ),
          getTestDifferentBankTransactions(
            {
              originUserId: '4-3',
              destinationUserId: '4-4',
              timestamp: dayjs('2022-01-01T01:00:00.000Z').valueOf(),
            },
            1,
            1
          ),
          getTestDifferentBankTransactions(
            {
              originUserId: '4-5',
              destinationUserId: '4-6',
              timestamp: dayjs('2022-01-01T02:00:00.000Z').valueOf(),
            },
            2,
            2
          ),
        ],
        expectedHits: [false, false, false],
      },
      {
        name: 'Frequent transactions without user IDs - not hit',
        transactions: [
          getTestDifferentBankTransactions(
            {
              originUserId: undefined,
              destinationUserId: undefined,
              timestamp: dayjs('2022-01-01T00:00:00.000Z').valueOf(),
            },
            0,
            0
          ),
          getTestDifferentBankTransactions(
            {
              originUserId: undefined,
              destinationUserId: undefined,
              timestamp: dayjs('2022-01-01T01:00:00.000Z').valueOf(),
            },
            1,
            1
          ),
          getTestDifferentBankTransactions(
            {
              originUserId: undefined,
              destinationUserId: undefined,
              timestamp: dayjs('2022-01-01T02:00:00.000Z').valueOf(),
            },
            2,
            2
          ),
        ],
        expectedHits: [false, false, false],
      },
      {
        name: 'Normal transactions - not hit',
        transactions: [
          getTestDifferentBankTransactions(
            {
              originUserId: '5-1',
              destinationUserId: '5-2',
              timestamp: dayjs('2022-01-01T00:00:00.000Z').valueOf(),
            },
            0,
            0
          ),
          getTestDifferentBankTransactions(
            {
              originUserId: '5-1',
              destinationUserId: '5-3',
              timestamp: dayjs('2022-01-01T10:00:00.000Z').valueOf(),
            },
            1,
            1
          ),
          getTestDifferentBankTransactions(
            {
              originUserId: '5-1',
              destinationUserId: '5-4',
              timestamp: dayjs('2022-01-01T20:00:00.000Z').valueOf(),
            },
            2,
            2
          ),
        ],
        expectedHits: [false, false, false],
      },
      {
        name: 'Too frequent transactions - hit twice',
        transactions: [
          getTestDifferentBankTransactions(
            {
              originUserId: '6-1',
              destinationUserId: '6-2',
              timestamp: dayjs('2022-01-01T00:00:00.000Z').valueOf(),
            },
            0,
            0
          ),
          getTestDifferentBankTransactions(
            {
              originUserId: '6-1',
              destinationUserId: '6-3',
              timestamp: dayjs('2022-01-01T01:00:00.000Z').valueOf(),
            },
            1,
            1
          ),
          getTestDifferentBankTransactions(
            {
              originUserId: '6-1',
              destinationUserId: '6-4',
              timestamp: dayjs('2022-01-01T02:00:00.000Z').valueOf(),
            },
            2,
            2
          ),
          getTestDifferentBankTransactions(
            {
              originUserId: '6-1',
              destinationUserId: '6-2',
              timestamp: dayjs('2022-01-02T00:10:00.000Z').valueOf(),
            },
            3,
            3
          ),
          getTestDifferentBankTransactions(
            {
              originUserId: '6-1',
              destinationUserId: '6-3',
              timestamp: dayjs('2022-01-02T00:10:01.000Z').valueOf(),
            },
            4,
            4
          ),
          getTestDifferentBankTransactions(
            {
              originUserId: '6-1',
              destinationUserId: '6-4',
              timestamp: dayjs('2022-01-02T00:10:02.000Z').valueOf(),
            },
            5,
            5
          ),
        ],
        expectedHits: [false, false, true, false, false, true],
      },
      {
        name: 'Out-of-order transactions - not hit',
        transactions: [
          getTestDifferentBankTransactions(
            {
              originUserId: '7-1',
              destinationUserId: '7-4',
              timestamp: dayjs('2022-01-01T02:00:00.000Z').valueOf(),
            },
            0,
            0
          ),
          getTestDifferentBankTransactions(
            {
              originUserId: '7-1',
              destinationUserId: '7-3',
              timestamp: dayjs('2022-01-01T01:00:00.000Z').valueOf(),
            },
            1,
            1
          ),
          getTestDifferentBankTransactions(
            {
              originUserId: '7-1',
              destinationUserId: '7-2',
              timestamp: dayjs('2022-01-01T00:00:00.000Z').valueOf(),
            },
            2,
            2
          ),
        ],
        expectedHits: [false, false, false],
      },
      {
        name: 'Duplicated transactions - not hit',
        transactions: [
          getTestDifferentBankTransactions(
            {
              transactionId: '8-1',
              originUserId: '8-1',
              destinationUserId: '8-2',
              timestamp: dayjs('2022-01-01T00:00:00.000Z').valueOf(),
            },
            0,
            0
          ),
          getTestDifferentBankTransactions(
            {
              transactionId: '8-1',
              originUserId: '8-1',
              destinationUserId: '8-2',
              timestamp: dayjs('2022-01-01T00:00:00.000Z').valueOf(),
            },
            0,
            0
          ),
          getTestDifferentBankTransactions(
            {
              transactionId: '8-1',
              originUserId: '8-1',
              destinationUserId: '8-2',
              timestamp: dayjs('2022-01-01T00:00:00.000Z').valueOf(),
            },
            0,
            0
          ),
        ],
        expectedHits: [false, false, false],
      },
      {
        name: 'Transactions with same timestamp - not hit',
        transactions: [
          getTestDifferentBankTransactions(
            {
              transactionId: '9-1',
              originUserId: '9-1',
              destinationUserId: '9-2',
              timestamp: dayjs('2022-01-01T00:00:00.000Z').valueOf(),
            },
            0,
            0
          ),
          getTestDifferentBankTransactions(
            {
              transactionId: '9-2',
              originUserId: '9-1',
              destinationUserId: '9-2',
              timestamp: dayjs('2022-01-01T02:00:00.000Z').valueOf(),
            },
            1,
            1
          ),
          getTestDifferentBankTransactions(
            {
              transactionId: '9-3',
              originUserId: '9-1',
              destinationUserId: '9-2',
              timestamp: dayjs('2022-01-01T02:00:00.000Z').valueOf(),
            },
            2,
            2
          ),
        ],
        expectedHits: [false, false, false],
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

  describe('check for first transaction', () => {
    const TEST_TENANT_ID = getTestTenantId()

    setUpRulesHooks(TEST_TENANT_ID, [
      {
        type: 'TRANSACTION',
        ruleImplementationName: 'using-too-many-banks-to-make-payments',
        defaultParameters: {
          banksLimit: 0,
          timeWindow: {
            units: 5,
            granularity: 'hour',
          },
          checkSender: 'all',
          checkReceiver: 'all',
        } as UsingTooManyBanksToMakePaymentsRuleParameters,
      },
    ])
    describe.each<TransactionRuleTestCase>([
      {
        name: '1 bank used',
        transactions: [
          getTestDifferentBankTransactions(
            {
              transactionId: '9-1',
              originUserId: '9-1',
              destinationUserId: '9-2',
              timestamp: dayjs('2022-01-01T00:00:00.000Z').valueOf(),
              originPaymentDetails: {
                method: 'CARD',
                cardFingerprint: uuidv4(),
                cardIssuedCountry: 'US',
                transactionReferenceField: 'DEPOSIT',
                '3dsDone': true,
              },
              destinationPaymentDetails: {
                method: 'CARD',
                cardFingerprint: uuidv4(),
                cardIssuedCountry: 'IN',
                transactionReferenceField: 'DEPOSIT',
                '3dsDone': true,
              },
            },
            0,
            0
          ),
          getTestDifferentBankTransactions(
            {
              originUserId: '9-3',
              destinationUserId: '9-4',
              timestamp: dayjs('2022-01-01T00:00:00.000Z').valueOf(),
            },
            0,
            0
          ),
        ],
        expectedHits: [false, true],
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
  describe('checksender/checkreceiver', () => {
    const TEST_HIT_TRANSACTIONS = [
      getTestDifferentBankTransactions(
        {
          originUserId: '1-1',
          destinationUserId: '1-2',
          timestamp: dayjs('2022-01-01T00:00:00.000Z').valueOf(),
        },
        0,
        0
      ),
      getTestDifferentBankTransactions(
        {
          originUserId: '1-1',
          destinationUserId: '1-2',
          timestamp: dayjs('2022-01-01T01:00:00.000Z').valueOf(),
        },
        1,
        1
      ),
      getTestDifferentBankTransactions(
        {
          originUserId: '1-1',
          destinationUserId: '1-2',
          timestamp: dayjs('2022-01-01T02:00:00.000Z').valueOf(),
        },
        2,
        2
      ),
      getTestDifferentBankTransactions(
        {
          originUserId: '1-4',
          destinationUserId: '1-3',
          timestamp: dayjs('2022-01-01T03:00:00.000Z').valueOf(),
        },
        0,
        0
      ),
      getTestDifferentBankTransactions(
        {
          originUserId: '1-5',
          destinationUserId: '1-3',
          timestamp: dayjs('2022-01-01T04:00:00.000Z').valueOf(),
        },
        1,
        1
      ),
      getTestDifferentBankTransactions(
        {
          originUserId: '1-6',
          destinationUserId: '1-3',
          timestamp: dayjs('2022-01-01T05:00:00.000Z').valueOf(),
        },
        2,
        2
      ),
    ]

    describe.each<
      TransactionRuleTestCase<
        Partial<UsingTooManyBanksToMakePaymentsRuleParameters>
      >
    >([
      {
        name: 'Sender: all, Receiver: all',
        transactions: TEST_HIT_TRANSACTIONS,
        expectedHits: [false, false, true, false, false, true],
        ruleParams: {
          checkSender: 'all',
          checkReceiver: 'all',
        },
      },
      {
        name: 'Sender: sending, Receiver: none',
        transactions: TEST_HIT_TRANSACTIONS,
        expectedHits: [false, false, true, false, false, false],
        ruleParams: {
          checkSender: 'sending',
          checkReceiver: 'none',
        },
      },
      {
        name: 'Sender: all, Receiver: none',
        transactions: TEST_HIT_TRANSACTIONS,
        expectedHits: [false, false, true, false, false, false],
        ruleParams: {
          checkSender: 'all',
          checkReceiver: 'none',
        },
      },
      {
        name: 'Sender: none, Receiver: receiving',
        transactions: TEST_HIT_TRANSACTIONS,
        expectedHits: [false, false, true, false, false, true],
        ruleParams: {
          checkSender: 'none',
          checkReceiver: 'receiving',
        },
      },
      {
        name: 'Sender: none, Receiver: none',
        transactions: TEST_HIT_TRANSACTIONS,
        expectedHits: [false, false, false, false, false, false],
        ruleParams: {
          checkSender: 'none',
          checkReceiver: 'none',
        },
      },
    ])('', ({ name, transactions, expectedHits, ruleParams }) => {
      const TEST_TENANT_ID = getTestTenantId()

      setUpRulesHooks(TEST_TENANT_ID, [
        {
          type: 'TRANSACTION',
          ruleImplementationName: 'using-too-many-banks-to-make-payments',
          defaultParameters: {
            banksLimit: 2,
            timeWindow: {
              units: 5,
              granularity: 'hour',
            },
            ...ruleParams,
          } as UsingTooManyBanksToMakePaymentsRuleParameters,
        },
      ])
      createTransactionRuleTestCase(
        name,
        TEST_TENANT_ID,
        transactions,
        expectedHits
      )
    })
  })

  describe('Rolling basis parameter', () => {
    const TEST_TENANT_ID = getTestTenantId()

    setUpRulesHooks(TEST_TENANT_ID, [
      {
        type: 'TRANSACTION',
        ruleImplementationName: 'using-too-many-banks-to-make-payments',
        defaultParameters: {
          banksLimit: 1,
          timeWindow: {
            units: 1,
            granularity: 'day',
            rollingBasis: false,
          },
          checkSender: 'all',
          checkReceiver: 'all',
        } as UsingTooManyBanksToMakePaymentsRuleParameters,
      },
    ])

    describe.each<TransactionRuleTestCase>([
      {
        name: 'Transaction out of limit - hit',
        transactions: [
          getTestDifferentBankTransactions(
            {
              originUserId: '1-1',
              destinationUserId: '1-2',
              timestamp: dayjs('2022-01-01T00:00:01.000Z').valueOf(),
            },
            0,
            0
          ),
          getTestDifferentBankTransactions(
            {
              originUserId: '1-1',
              destinationUserId: '1-3',
              timestamp: dayjs('2022-01-01T00:00:02.000Z').valueOf(),
            },
            1,
            1
          ),
        ],
        expectedHits: [false, true],
      },
      {
        name: 'Transaction in limit - not hit',
        transactions: [
          getTestDifferentBankTransactions(
            {
              originUserId: '2-1',
              destinationUserId: '2-2',
              timestamp: dayjs('2022-01-01T11:59:59.000Z').valueOf(),
            },
            0,
            0
          ),
          getTestDifferentBankTransactions(
            {
              originUserId: '2-1',
              destinationUserId: '2-3',
              timestamp: dayjs('2022-01-02T00:00:01.000Z').valueOf(),
            },
            1,
            1
          ),
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
  })
})

testAggregationRebuild(
  getTestTenantId(),
  {
    type: 'TRANSACTION',
    ruleImplementationName: 'using-too-many-banks-to-make-payments',
    defaultParameters: DEFAULT_RULE_PARAMETERS,
  },
  [
    getTestDifferentBankTransactions(
      {
        originUserId: '1',
        destinationUserId: '2',
        timestamp: dayjs('2022-01-01T00:00:00.000Z').valueOf(),
      },
      0,
      0
    ),
    getTestDifferentBankTransactions(
      {
        originUserId: '1',
        destinationUserId: '3',
        timestamp: dayjs('2022-01-01T00:30:00.000Z').valueOf(),
      },
      1,
      1
    ),
    getTestDifferentBankTransactions(
      {
        originUserId: '1',
        destinationUserId: '3',
        timestamp: dayjs('2022-01-01T02:00:00.000Z').valueOf(),
      },
      3,
      3
    ),
  ],
  {
    origin: [
      {
        uniqueBanks: ['Swiss Bank', 'US Bank'],
        hour: '2022010100',
      },
      {
        uniqueBanks: ['US Federal Bank'],
        hour: '2022010102',
      },
    ],
    destination: [
      {
        uniqueBanks: ['Swiss Bank'],
        hour: '2022010100',
      },
      {
        uniqueBanks: ['US Federal Bank'],
        hour: '2022010102',
      },
    ],
  }
)
