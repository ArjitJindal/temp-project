import dayjs from 'dayjs'
import _ from 'lodash'
import { getTransactionRuleByRuleId } from '../library'
import { UserTransactionLimitsRuleParameter } from '../user-transaction-limits'
import { getTestTenantId } from '@/test-utils/tenant-test-utils'
import { getTestTransaction } from '@/test-utils/transaction-test-utils'
import {
  createTransactionRuleTestCase,
  setUpRulesHooks,
  testRuleDescriptionFormatting,
  TransactionRuleTestCase,
} from '@/test-utils/rule-test-utils'
import { dynamoDbSetupHook } from '@/test-utils/dynamodb-test-utils'
import { getTestUser, setUpUsersHooks } from '@/test-utils/user-test-utils'

dynamoDbSetupHook()

describe('R-99 description formatting', () => {
  const TEST_TENANT_ID = getTestTenantId()
  setUpRulesHooks(TEST_TENANT_ID, [
    {
      type: 'TRANSACTION',
      ruleImplementationName: 'user-transaction-limits',
      defaultAction: 'FLAG',
    },
  ])
  setUpUsersHooks(TEST_TENANT_ID, [
    getTestUser({
      userId: '1',
      transactionLimits: {
        maximumDailyTransactionLimit: {
          amountCurrency: 'EUR',
          amountValue: 100,
        },
        maximumTransactionLimit: { amountCurrency: 'EUR', amountValue: 200 },
        paymentMethodLimits: {
          CARD: {
            transactionAmountLimit: {
              day: { amountCurrency: 'EUR', amountValue: 300 },
            },
            transactionCountLimit: {
              week: 0,
            },
            averageTransactionAmountLimit: {
              month: { amountCurrency: 'EUR', amountValue: 400 },
            },
          },
        },
      },
    }),
  ])

  testRuleDescriptionFormatting(
    'basic case',
    TEST_TENANT_ID,
    [
      getTestTransaction({
        timestamp: dayjs('2022-01-01T00:00:00.000Z').valueOf(),
        originUserId: '1',
        originAmountDetails: {
          transactionAmount: 10000,
          transactionCurrency: 'EUR',
        },
      }),
      getTestTransaction({
        timestamp: dayjs('2023-01-01T00:00:00.000Z').valueOf(),
        originUserId: '1',
        originAmountDetails: {
          transactionAmount: 1,
          transactionCurrency: 'EUR',
        },
      }),
    ],
    {
      descriptionTemplate:
        getTransactionRuleByRuleId('R-99').descriptionTemplate,
    },
    [
      'Sender sent a transaction amount of 10000.00 EUR more than the limit (200.00 EUR). Sender reached the daily transaction amount limit (100.00 EUR). Sender reached the daily transaction amount limit (300.00 EUR) of CARD payment method. Sender reached the monthly average transaction amount limit (400.00 EUR) of CARD payment method. Sender reached the weekly transaction count limit (0) of CARD payment method.',
      'Sender reached the weekly transaction count limit (0) of CARD payment method.',
    ]
  )
})

describe('maximumTransactionLimit', () => {
  const TEST_TENANT_ID = getTestTenantId()
  setUpRulesHooks(TEST_TENANT_ID, [
    {
      type: 'TRANSACTION',
      ruleImplementationName: 'user-transaction-limits',
      defaultAction: 'FLAG',
    },
  ])
  setUpUsersHooks(TEST_TENANT_ID, [
    getTestUser({
      userId: '1',
      transactionLimits: {
        maximumTransactionLimit: { amountCurrency: 'EUR', amountValue: 1000 },
      },
    }),
    getTestUser({
      userId: '2',
    }),
  ])
  describe.each<TransactionRuleTestCase>([
    {
      name: 'Transaction amount exceeds user specific limit - hit',
      transactions: [
        getTestTransaction({
          originUserId: '1',
          originAmountDetails: {
            transactionAmount: 10000,
            transactionCurrency: 'EUR',
          },
        }),
      ],
      expectedHits: [true],
    },
    {
      name: 'Transaction amount exceeds user specific limit (different currency) - hit',
      transactions: [
        getTestTransaction({
          originUserId: '1',
          originAmountDetails: {
            transactionAmount: 10000,
            transactionCurrency: 'USD',
          },
        }),
      ],
      expectedHits: [true],
    },
    {
      name: "Transaction amount doesn't exceed user specific limit - not hit",
      transactions: [
        getTestTransaction({
          originUserId: '1',
          originAmountDetails: {
            transactionAmount: 100,
            transactionCurrency: 'EUR',
          },
        }),
      ],
      expectedHits: [false],
    },
    {
      name: 'User has no transaction limit - not hit',
      transactions: [
        getTestTransaction({
          originUserId: '2',
          originAmountDetails: {
            transactionAmount: 100000000000,
            transactionCurrency: 'EUR',
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

describe('Time-based limits', () => {
  describe.each([
    {
      limitKey: 'maximumDailyTransactionLimit',
      transactions: [
        getTestTransaction({
          timestamp: dayjs('2022-01-01T06:00:00.000Z').valueOf(),
          originUserId: '1',
          originAmountDetails: {
            transactionAmount: 600,
            transactionCurrency: 'EUR',
          },
        }),
        getTestTransaction({
          timestamp: dayjs('2022-01-01T12:00:00.000Z').valueOf(),
          originUserId: '1',
          originAmountDetails: {
            transactionAmount: 600,
            transactionCurrency: 'EUR',
          },
        }),
        getTestTransaction({
          timestamp: dayjs('2022-01-02T12:00:00.000Z').valueOf(),
          originUserId: '1',
          originAmountDetails: {
            transactionAmount: 600,
            transactionCurrency: 'EUR',
          },
        }),
      ],
      expectedHits: [false, true, false],
    },
    {
      limitKey: 'maximumWeeklyTransactionLimit',
      transactions: [
        getTestTransaction({
          timestamp: dayjs('2022-01-03T06:00:00.000Z').valueOf(),
          originUserId: '1',
          originAmountDetails: {
            transactionAmount: 600,
            transactionCurrency: 'EUR',
          },
        }),
        getTestTransaction({
          timestamp: dayjs('2022-01-06T06:00:00.000Z').valueOf(),
          originUserId: '1',
          originAmountDetails: {
            transactionAmount: 600,
            transactionCurrency: 'EUR',
          },
        }),
        getTestTransaction({
          timestamp: dayjs('2022-01-10T06:00:00.000Z').valueOf(),
          originUserId: '1',
          originAmountDetails: {
            transactionAmount: 600,
            transactionCurrency: 'EUR',
          },
        }),
      ],
      expectedHits: [false, true, false],
    },
    {
      limitKey: 'maximumMonthlyTransactionLimit',
      transactions: [
        getTestTransaction({
          timestamp: dayjs('2022-01-01T06:00:00.000Z').valueOf(),
          originUserId: '1',
          originAmountDetails: {
            transactionAmount: 600,
            transactionCurrency: 'EUR',
          },
        }),
        getTestTransaction({
          timestamp: dayjs('2022-01-15T06:00:00.000Z').valueOf(),
          originUserId: '1',
          originAmountDetails: {
            transactionAmount: 600,
            transactionCurrency: 'EUR',
          },
        }),
        getTestTransaction({
          timestamp: dayjs('2022-02-01T06:00:00.000Z').valueOf(),
          originUserId: '1',
          originAmountDetails: {
            transactionAmount: 600,
            transactionCurrency: 'EUR',
          },
        }),
      ],
      expectedHits: [false, true, false],
    },
    {
      limitKey: 'maximumYearlyTransactionLimit',
      transactions: [
        getTestTransaction({
          timestamp: dayjs('2022-01-01T06:00:00.000Z').valueOf(),
          originUserId: '1',
          originAmountDetails: {
            transactionAmount: 600,
            transactionCurrency: 'EUR',
          },
        }),
        getTestTransaction({
          timestamp: dayjs('2022-06-01T06:00:00.000Z').valueOf(),
          originUserId: '1',
          originAmountDetails: {
            transactionAmount: 600,
            transactionCurrency: 'EUR',
          },
        }),
        getTestTransaction({
          timestamp: dayjs('2023-01-01T06:00:00.000Z').valueOf(),
          originUserId: '1',
          originAmountDetails: {
            transactionAmount: 600,
            transactionCurrency: 'EUR',
          },
        }),
      ],
      expectedHits: [false, true, false],
    },
  ])('', ({ limitKey, transactions, expectedHits }) => {
    const TEST_TENANT_ID = getTestTenantId()
    setUpRulesHooks(TEST_TENANT_ID, [
      {
        type: 'TRANSACTION',
        ruleImplementationName: 'user-transaction-limits',
        defaultAction: 'FLAG',
      },
    ])
    setUpUsersHooks(TEST_TENANT_ID, [
      getTestUser({
        userId: '1',
        transactionLimits: {
          [limitKey]: { amountCurrency: 'EUR', amountValue: 1000 },
        },
      }),
    ])
    createTransactionRuleTestCase(
      limitKey,
      TEST_TENANT_ID,
      transactions,
      expectedHits
    )
  })

  describe.each([
    {
      path: 'transactionLimits.paymentMethodLimits.CARD',
      limit: {
        transactionAmountLimit: {
          day: { amountValue: 1000, amountCurrency: 'EUR' },
        },
      },
      transactions: [
        getTestTransaction({
          timestamp: dayjs('2022-01-01T06:00:00.000Z').valueOf(),
          originUserId: '1',
          originPaymentDetails: {
            method: 'CARD',
          },
          originAmountDetails: {
            transactionAmount: 600,
            transactionCurrency: 'EUR',
          },
        }),
        getTestTransaction({
          timestamp: dayjs('2022-01-01T12:00:00.000Z').valueOf(),
          originUserId: '1',
          originPaymentDetails: {
            method: 'CARD',
          },
          originAmountDetails: {
            transactionAmount: 600,
            transactionCurrency: 'EUR',
          },
        }),
        getTestTransaction({
          timestamp: dayjs('2022-01-01T12:00:00.000Z').valueOf(),
          originUserId: '1',
          originPaymentDetails: {
            method: 'ACH',
          },
          originAmountDetails: {
            transactionAmount: 600,
            transactionCurrency: 'EUR',
          },
        }),
        getTestTransaction({
          timestamp: dayjs('2022-01-02T12:00:00.000Z').valueOf(),
          originUserId: '1',
          originPaymentDetails: {
            method: 'CARD',
          },
          originAmountDetails: {
            transactionAmount: 600,
            transactionCurrency: 'EUR',
          },
        }),
      ],
      expectedHits: [false, true, false, false],
    },
    {
      path: 'transactionLimits.paymentMethodLimits.ACH',
      limit: {
        transactionCountLimit: {
          week: 1,
        },
      },
      transactions: [
        getTestTransaction({
          timestamp: dayjs('2022-01-03T06:00:00.000Z').valueOf(),
          originUserId: '1',
          originPaymentDetails: {
            method: 'ACH',
          },
          originAmountDetails: {
            transactionAmount: 1,
            transactionCurrency: 'EUR',
          },
        }),
        getTestTransaction({
          timestamp: dayjs('2022-01-04T12:00:00.000Z').valueOf(),
          originUserId: '1',
          originPaymentDetails: {
            method: 'ACH',
          },
          originAmountDetails: {
            transactionAmount: 1,
            transactionCurrency: 'EUR',
          },
        }),
        getTestTransaction({
          timestamp: dayjs('2022-01-04T12:00:00.000Z').valueOf(),
          originUserId: '1',
          originPaymentDetails: {
            method: 'CARD',
          },
          originAmountDetails: {
            transactionAmount: 1,
            transactionCurrency: 'EUR',
          },
        }),
        getTestTransaction({
          timestamp: dayjs('2022-01-10T12:00:00.000Z').valueOf(),
          originUserId: '1',
          originPaymentDetails: {
            method: 'ACH',
          },
          originAmountDetails: {
            transactionAmount: 1,
            transactionCurrency: 'EUR',
          },
        }),
      ],
      expectedHits: [false, true, false, false],
    },
    {
      path: 'transactionLimits.paymentMethodLimits.IBAN',
      limit: {
        averageTransactionAmountLimit: {
          month: { amountValue: 1000, amountCurrency: 'EUR' },
        },
      },
      transactions: [
        getTestTransaction({
          timestamp: dayjs('2022-01-01T06:00:00.000Z').valueOf(),
          originUserId: '1',
          originPaymentDetails: {
            method: 'IBAN',
          },
          originAmountDetails: {
            transactionAmount: 800,
            transactionCurrency: 'EUR',
          },
        }),
        getTestTransaction({
          timestamp: dayjs('2022-01-15T06:00:00.000Z').valueOf(),
          originUserId: '1',
          originPaymentDetails: {
            method: 'IBAN',
          },
          originAmountDetails: {
            transactionAmount: 2000,
            transactionCurrency: 'EUR',
          },
        }),
        getTestTransaction({
          timestamp: dayjs('2022-01-15T06:00:00.000Z').valueOf(),
          originUserId: '1',
          originPaymentDetails: {
            method: 'CARD',
          },
          originAmountDetails: {
            transactionAmount: 2000,
            transactionCurrency: 'EUR',
          },
        }),
        getTestTransaction({
          timestamp: dayjs('2022-02-01T12:00:00.000Z').valueOf(),
          originUserId: '1',
          originPaymentDetails: {
            method: 'IBAN',
          },
          originAmountDetails: {
            transactionAmount: 800,
            transactionCurrency: 'EUR',
          },
        }),
      ],
      expectedHits: [false, true, false, false],
    },
  ])('', ({ path, limit, transactions, expectedHits }) => {
    const TEST_TENANT_ID = getTestTenantId()
    setUpRulesHooks(TEST_TENANT_ID, [
      {
        type: 'TRANSACTION',
        ruleImplementationName: 'user-transaction-limits',
        defaultAction: 'FLAG',
      },
    ])
    setUpUsersHooks(TEST_TENANT_ID, [
      getTestUser(
        _.set(
          {
            userId: '1',
          },
          path,
          limit
        )
      ),
    ])
    createTransactionRuleTestCase(
      path,
      TEST_TENANT_ID,
      transactions,
      expectedHits
    )
  })
})

describe('Only check payment method limits', () => {
  const TEST_TENANT_ID = getTestTenantId()
  setUpRulesHooks(TEST_TENANT_ID, [
    {
      type: 'TRANSACTION',
      ruleImplementationName: 'user-transaction-limits',
      defaultAction: 'FLAG',
      defaultParameters: {
        onlyCheckTypes: ['PAYMENT_METHOD'],
      } as UserTransactionLimitsRuleParameter,
    },
  ])
  setUpUsersHooks(TEST_TENANT_ID, [
    getTestUser({
      userId: '1',
      transactionLimits: {
        maximumTransactionLimit: { amountCurrency: 'EUR', amountValue: 1000 },
        paymentMethodLimits: {
          CARD: {
            transactionAmountLimit: {
              day: { amountValue: 1000, amountCurrency: 'EUR' },
            },
          },
        },
      },
    }),
  ])
  createTransactionRuleTestCase(
    '',
    TEST_TENANT_ID,
    [
      getTestTransaction({
        originUserId: '1',
        originAmountDetails: {
          transactionAmount: 10000,
          transactionCurrency: 'EUR',
        },
        originPaymentDetails: { method: 'ACH' },
      }),
      getTestTransaction({
        originUserId: '1',
        originAmountDetails: {
          transactionAmount: 10000,
          transactionCurrency: 'EUR',
        },
        originPaymentDetails: { method: 'CARD' },
      }),
    ],
    [false, true]
  )
})

describe('Only check all transactions limits', () => {
  const TEST_TENANT_ID = getTestTenantId()
  setUpRulesHooks(TEST_TENANT_ID, [
    {
      type: 'TRANSACTION',
      ruleImplementationName: 'user-transaction-limits',
      defaultAction: 'FLAG',
      defaultParameters: {
        onlyCheckTypes: ['ALL_TRANSACTIONS'],
      } as UserTransactionLimitsRuleParameter,
    },
  ])
  setUpUsersHooks(TEST_TENANT_ID, [
    getTestUser({
      userId: '1',
      transactionLimits: {
        maximumTransactionLimit: { amountCurrency: 'EUR', amountValue: 1000 },
        paymentMethodLimits: {
          CARD: {
            transactionAmountLimit: {
              day: { amountValue: 100, amountCurrency: 'EUR' },
            },
          },
        },
      },
    }),
  ])
  createTransactionRuleTestCase(
    '',
    TEST_TENANT_ID,
    [
      getTestTransaction({
        originUserId: '1',
        originAmountDetails: {
          transactionAmount: 10000,
          transactionCurrency: 'EUR',
        },
        originPaymentDetails: { method: 'ACH' },
      }),
      getTestTransaction({
        originUserId: '1',
        originAmountDetails: {
          transactionAmount: 500,
          transactionCurrency: 'EUR',
        },
        originPaymentDetails: { method: 'CARD' },
      }),
    ],
    [true, false]
  )
})

describe('Check Thresholds', () => {
  const TEST_TENANT_ID = getTestTenantId()
  setUpRulesHooks(TEST_TENANT_ID, [
    {
      type: 'TRANSACTION',
      ruleImplementationName: 'user-transaction-limits',
      defaultAction: 'FLAG',
      defaultParameters: {
        onlyCheckTypes: ['ALL_TRANSACTIONS'],
        timeWindow: {
          units: 1,
          granularity: 'day',
          rollingBasis: true,
        },
        threshold: 2,
      } as UserTransactionLimitsRuleParameter,
    },
  ])
  setUpUsersHooks(TEST_TENANT_ID, [
    getTestUser({
      userId: '10',
      transactionLimits: {
        maximumTransactionLimit: { amountCurrency: 'EUR', amountValue: 1000 },
        paymentMethodLimits: {
          CARD: {
            transactionAmountLimit: {
              day: { amountValue: 100, amountCurrency: 'EUR' },
            },
          },
        },
      },
    }),
  ])
  createTransactionRuleTestCase(
    '',
    TEST_TENANT_ID,
    [
      getTestTransaction({
        originUserId: '10',
        originAmountDetails: {
          transactionAmount: 10000,
          transactionCurrency: 'EUR',
        },
        originPaymentDetails: { method: 'ACH' },
        timestamp: dayjs('2022-01-01T12:00:00.000Z').valueOf(),
      }),
      getTestTransaction({
        originUserId: '10',
        originAmountDetails: {
          transactionAmount: 500,
          transactionCurrency: 'EUR',
        },
        originPaymentDetails: { method: 'CARD' },
        timestamp: dayjs('2022-01-01T13:00:00.000Z').valueOf(),
      }),
      getTestTransaction({
        originUserId: '10',
        originAmountDetails: {
          transactionAmount: 5000,
          transactionCurrency: 'EUR',
        },
        originPaymentDetails: { method: 'CARD' },
        timestamp: dayjs('2022-01-01T14:00:00.000Z').valueOf(),
      }),
      getTestTransaction({
        originUserId: '10',
        originAmountDetails: {
          transactionAmount: 500,
          transactionCurrency: 'EUR',
        },
        originPaymentDetails: { method: 'CARD' },
        timestamp: dayjs('2022-01-01T15:00:00.000Z').valueOf(),
      }),
    ],
    [false, false, true, false]
  )
})
