import { TransactionsOutflowInflowVolumeRuleParameters } from '../transactions-outflow-inflow-volume'
import { getRuleByRuleId } from '../library'
import { TransactionAmountDetails } from '@/@types/openapi-public/TransactionAmountDetails'
import {
  createTransactionRuleTestCase,
  ruleVariantsTest,
  setUpRulesHooks,
  testAggregationRebuild,
  testRuleDescriptionFormatting,
  TransactionRuleTestCase,
} from '@/test-utils/rule-test-utils'
import { getTestTenantId } from '@/test-utils/tenant-test-utils'
import { getTestTransaction } from '@/test-utils/transaction-test-utils'
import dayjs from '@/utils/dayjs'
import { dynamoDbSetupHook } from '@/test-utils/dynamodb-test-utils'

dynamoDbSetupHook()

const TEST_TRANSACTION_AMOUNT_100: TransactionAmountDetails = {
  transactionCurrency: 'USD',
  transactionAmount: 100,
}
const TEST_TRANSACTION_AMOUNT_200: TransactionAmountDetails = {
  transactionCurrency: 'USD',
  transactionAmount: 200,
}
const DEFAULT_RULE_PARAMETERS: TransactionsOutflowInflowVolumeRuleParameters = {
  timeWindow: {
    units: 1,
    granularity: 'day',
    rollingBasis: true,
  },
  outflowInflowComparator: 'GREATER_THAN_OR_EQUAL_TO',
  inflowTransactionTypes: ['DEPOSIT'],
  outflowTransactionTypes: ['WITHDRAWAL'],
}

ruleVariantsTest({ aggregation: true, v8: true }, () => {
  describe('Core logic', () => {
    describe('R-41 description formatting - gte', () => {
      const TEST_TENANT_ID = getTestTenantId()

      setUpRulesHooks(TEST_TENANT_ID, [
        {
          type: 'TRANSACTION',
          ruleImplementationName: 'transactions-outflow-inflow-volume',
          defaultParameters: DEFAULT_RULE_PARAMETERS,
        },
      ])

      testRuleDescriptionFormatting(
        'first',
        TEST_TENANT_ID,
        [
          getTestTransaction({
            destinationUserId: '2-1',
            type: 'DEPOSIT',
            destinationAmountDetails: TEST_TRANSACTION_AMOUNT_100,
            timestamp: dayjs('2022-01-01T00:00:00.000Z').valueOf(),
          }),
          getTestTransaction({
            originUserId: '2-1',
            type: 'WITHDRAWAL',
            originAmountDetails: TEST_TRANSACTION_AMOUNT_100,
            timestamp: dayjs('2022-01-01T00:10:00.000Z').valueOf(),
          }),
        ],
        {
          descriptionTemplate: getRuleByRuleId('R-41').descriptionTemplate,
        },
        [
          null,
          'Transaction outflow volume (100.00 USD) is greater than or equal to transaction inflow volume (100.00 USD).',
        ]
      )
    })

    describe('R-41 description formatting - lte', () => {
      const TEST_TENANT_ID = getTestTenantId()

      setUpRulesHooks(TEST_TENANT_ID, [
        {
          type: 'TRANSACTION',
          ruleImplementationName: 'transactions-outflow-inflow-volume',
          defaultParameters: {
            timeWindow: {
              units: 1,
              granularity: 'day',
              rollingBasis: true,
            },
            outflowInflowComparator: 'LESS_THAN_OR_EQUAL_TO',
            inflowTransactionTypes: ['DEPOSIT'],
            outflowTransactionTypes: ['WITHDRAWAL'],
          } as TransactionsOutflowInflowVolumeRuleParameters,
        },
      ])

      testRuleDescriptionFormatting(
        'first',
        TEST_TENANT_ID,
        [
          getTestTransaction({
            destinationUserId: '2-1',
            type: 'DEPOSIT',
            destinationAmountDetails: TEST_TRANSACTION_AMOUNT_200,
            timestamp: dayjs('2022-01-01T00:00:00.000Z').valueOf(),
          }),
          getTestTransaction({
            originUserId: '2-1',
            type: 'WITHDRAWAL',
            originAmountDetails: TEST_TRANSACTION_AMOUNT_100,
            timestamp: dayjs('2022-01-01T00:10:00.000Z').valueOf(),
          }),
        ],
        {
          descriptionTemplate: getRuleByRuleId('R-41').descriptionTemplate,
        },
        [
          null,
          'Transaction outflow volume (100.00 USD) is less than or equal to transaction inflow volume (200.00 USD).',
        ]
      )
    })

    describe.each<
      TransactionRuleTestCase<
        Partial<TransactionsOutflowInflowVolumeRuleParameters>
      >
    >([
      {
        name: 'outflow inflow same transaction type',
        transactions: [
          getTestTransaction({
            originUserId: '1-10',
            destinationUserId: '1-1',
            type: 'TRANSFER',
            originAmountDetails: TEST_TRANSACTION_AMOUNT_100,
            destinationAmountDetails: TEST_TRANSACTION_AMOUNT_100,
            timestamp: dayjs('2022-01-01T00:00:00.000Z').valueOf(),
          }),
          getTestTransaction({
            originUserId: '1-1',
            destinationUserId: '1-2',
            type: 'TRANSFER',
            originAmountDetails: TEST_TRANSACTION_AMOUNT_100,
            destinationAmountDetails: TEST_TRANSACTION_AMOUNT_100,
            timestamp: dayjs('2022-01-01T00:10:00.000Z').valueOf(),
          }),
          getTestTransaction({
            originUserId: '1-1',
            destinationUserId: '1-3',
            type: 'TRANSFER',
            originAmountDetails: TEST_TRANSACTION_AMOUNT_100,
            destinationAmountDetails: TEST_TRANSACTION_AMOUNT_100,
            timestamp: dayjs('2022-01-03T00:20:00.000Z').valueOf(),
          }),
        ],
        expectedHits: [false, true, false],
        ruleParams: {
          outflowTransactionTypes: ['TRANSFER'],
          inflowTransactionTypes: ['TRANSFER'],
          outflowInflowComparator: 'GREATER_THAN_OR_EQUAL_TO',
        },
      },
      {
        name: 'outflow inflow different transaction types',
        transactions: [
          getTestTransaction({
            destinationUserId: '2-1',
            type: 'DEPOSIT',
            destinationAmountDetails: TEST_TRANSACTION_AMOUNT_100,
            timestamp: dayjs('2022-01-01T00:00:00.000Z').valueOf(),
          }),
          getTestTransaction({
            originUserId: '2-1',
            type: 'WITHDRAWAL',
            originAmountDetails: TEST_TRANSACTION_AMOUNT_100,
            timestamp: dayjs('2022-01-01T00:10:00.000Z').valueOf(),
          }),
          getTestTransaction({
            originUserId: '2-1',
            type: 'DEPOSIT',
            originAmountDetails: TEST_TRANSACTION_AMOUNT_100,
            timestamp: dayjs('2022-01-03T00:20:00.000Z').valueOf(),
          }),
        ],
        expectedHits: [false, true, false],
        ruleParams: {
          outflowTransactionTypes: ['WITHDRAWAL'],
          inflowTransactionTypes: ['DEPOSIT'],
          outflowInflowComparator: 'GREATER_THAN_OR_EQUAL_TO',
        },
      },
      {
        name: 'transactions with non-target transaction type should be ignored',
        transactions: [
          getTestTransaction({
            destinationUserId: '2-1',
            type: 'DEPOSIT',
            destinationAmountDetails: TEST_TRANSACTION_AMOUNT_100,
            timestamp: dayjs('2022-01-01T00:00:00.000Z').valueOf(),
          }),
          getTestTransaction({
            originUserId: '2-1',
            type: 'REFUND',
            originAmountDetails: TEST_TRANSACTION_AMOUNT_100,
            timestamp: dayjs('2022-01-01T00:20:00.000Z').valueOf(),
          }),
          getTestTransaction({
            originUserId: '2-1',
            type: 'WITHDRAWAL',
            originAmountDetails: TEST_TRANSACTION_AMOUNT_100,
            timestamp: dayjs('2022-01-01T00:30:00.000Z').valueOf(),
          }),
        ],
        expectedHits: [false, false, true],
        ruleParams: {
          outflowTransactionTypes: ['WITHDRAWAL'],
          inflowTransactionTypes: ['DEPOSIT'],
          outflowInflowComparator: 'GREATER_THAN_OR_EQUAL_TO',
        },
      },
      {
        name: 'equal outflow inflow amount',
        transactions: [
          getTestTransaction({
            destinationUserId: '2-1',
            type: 'DEPOSIT',
            destinationAmountDetails: TEST_TRANSACTION_AMOUNT_100,
            timestamp: dayjs('2022-01-01T00:00:00.000Z').valueOf(),
          }),
          getTestTransaction({
            originUserId: '2-1',
            type: 'WITHDRAWAL',
            originAmountDetails: TEST_TRANSACTION_AMOUNT_100,
            timestamp: dayjs('2022-01-01T00:10:00.000Z').valueOf(),
          }),
        ],
        expectedHits: [false, true],
        ruleParams: {
          outflowTransactionTypes: ['WITHDRAWAL'],
          inflowTransactionTypes: ['DEPOSIT'],
          outflowInflowComparator: 'GREATER_THAN_OR_EQUAL_TO',
        },
      },
      {
        name: 'outflow less than inflow',
        transactions: [
          getTestTransaction({
            destinationUserId: '2-1',
            type: 'DEPOSIT',
            destinationAmountDetails: TEST_TRANSACTION_AMOUNT_200,
            timestamp: dayjs('2022-01-01T00:00:00.000Z').valueOf(),
          }),
          getTestTransaction({
            originUserId: '2-1',
            type: 'WITHDRAWAL',
            originAmountDetails: TEST_TRANSACTION_AMOUNT_100,
            timestamp: dayjs('2022-01-01T00:10:00.000Z').valueOf(),
          }),
        ],
        expectedHits: [false, true],
        ruleParams: {
          outflowTransactionTypes: ['WITHDRAWAL'],
          inflowTransactionTypes: ['DEPOSIT'],
          outflowInflowComparator: 'LESS_THAN_OR_EQUAL_TO',
        },
      },
    ])('', ({ name, transactions, expectedHits, ruleParams }) => {
      const TEST_TENANT_ID = getTestTenantId()

      setUpRulesHooks(TEST_TENANT_ID, [
        {
          type: 'TRANSACTION',
          ruleImplementationName: 'transactions-outflow-inflow-volume',
          defaultParameters: {
            timeWindow: {
              units: 1,
              granularity: 'day',
              rollingBasis: true,
            },
            ...ruleParams,
          } as TransactionsOutflowInflowVolumeRuleParameters,
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

  describe('Optional parameters', () => {
    describe.each<
      TransactionRuleTestCase<
        Partial<TransactionsOutflowInflowVolumeRuleParameters>
      >
    >([
      {
        name: 'outflow 3ds done percentage threshold',
        transactions: [
          getTestTransaction({
            originUserId: '1-10',
            destinationUserId: '1-1',
            type: 'TRANSFER',
            originAmountDetails: TEST_TRANSACTION_AMOUNT_100,
            destinationAmountDetails: TEST_TRANSACTION_AMOUNT_100,
            timestamp: dayjs('2022-01-01T00:00:00.000Z').valueOf(),
          }),
          getTestTransaction({
            originUserId: '1-1',
            destinationUserId: '1-2',
            type: 'TRANSFER',
            originAmountDetails: TEST_TRANSACTION_AMOUNT_100,
            destinationAmountDetails: TEST_TRANSACTION_AMOUNT_100,
            timestamp: dayjs('2022-01-01T00:10:00.000Z').valueOf(),
            originPaymentDetails: {
              method: 'CARD',
              '3dsDone': false,
            },
          }),
          getTestTransaction({
            originUserId: '1-1',
            destinationUserId: '1-2',
            type: 'TRANSFER',
            originAmountDetails: TEST_TRANSACTION_AMOUNT_100,
            destinationAmountDetails: TEST_TRANSACTION_AMOUNT_100,
            timestamp: dayjs('2022-01-01T00:20:00.000Z').valueOf(),
            originPaymentDetails: {
              method: 'CARD',
              '3dsDone': true,
            },
          }),
          getTestTransaction({
            originUserId: '1-1',
            destinationUserId: '1-2',
            type: 'TRANSFER',
            originAmountDetails: TEST_TRANSACTION_AMOUNT_100,
            destinationAmountDetails: TEST_TRANSACTION_AMOUNT_100,
            timestamp: dayjs('2022-01-01T00:30:00.000Z').valueOf(),
            originPaymentDetails: {
              method: 'CARD',
              '3dsDone': true,
            },
          }),
        ],
        expectedHits: [false, false, false, true],
        ruleParams: {
          outflowTransactionTypes: ['TRANSFER'],
          inflowTransactionTypes: ['TRANSFER'],
          outflowInflowComparator: 'GREATER_THAN_OR_EQUAL_TO',
          outflow3dsDonePercentageThreshold: {
            value: 60,
            comparator: 'GREATER_THAN_OR_EQUAL_TO',
          },
        },
      },
      {
        name: 'inflow 3ds done percentage threshold',
        transactions: [
          getTestTransaction({
            originUserId: '2-10',
            destinationUserId: '2-1',
            type: 'TRANSFER',
            originAmountDetails: TEST_TRANSACTION_AMOUNT_100,
            destinationAmountDetails: TEST_TRANSACTION_AMOUNT_100,
            timestamp: dayjs('2022-01-01T00:00:00.000Z').valueOf(),
            destinationPaymentDetails: {
              method: 'CARD',
              '3dsDone': false,
            },
          }),
          getTestTransaction({
            originUserId: '2-1',
            destinationUserId: '2-2',
            type: 'TRANSFER',
            originAmountDetails: TEST_TRANSACTION_AMOUNT_200,
            destinationAmountDetails: TEST_TRANSACTION_AMOUNT_100,
            timestamp: dayjs('2022-01-01T00:10:00.000Z').valueOf(),
          }),
          getTestTransaction({
            originUserId: '2-11',
            destinationUserId: '2-1',
            type: 'TRANSFER',
            originAmountDetails: TEST_TRANSACTION_AMOUNT_100,
            destinationAmountDetails: TEST_TRANSACTION_AMOUNT_100,
            timestamp: dayjs('2022-01-01T00:20:00.000Z').valueOf(),
            destinationPaymentDetails: {
              method: 'CARD',
              '3dsDone': true,
            },
          }),
          getTestTransaction({
            originUserId: '2-12',
            destinationUserId: '2-1',
            type: 'TRANSFER',
            originAmountDetails: TEST_TRANSACTION_AMOUNT_100,
            destinationAmountDetails: TEST_TRANSACTION_AMOUNT_100,
            timestamp: dayjs('2022-01-01T00:30:00.000Z').valueOf(),
            destinationPaymentDetails: {
              method: 'CARD',
              '3dsDone': true,
            },
          }),
        ],
        expectedHits: [false, false, false, true],
        ruleParams: {
          outflowTransactionTypes: ['TRANSFER'],
          inflowTransactionTypes: ['TRANSFER'],
          outflowInflowComparator: 'LESS_THAN_OR_EQUAL_TO',
          inflow3dsDonePercentageThreshold: {
            value: 60,
            comparator: 'GREATER_THAN_OR_EQUAL_TO',
          },
        },
      },
    ])('', ({ name, transactions, expectedHits, ruleParams }) => {
      const TEST_TENANT_ID = getTestTenantId()

      setUpRulesHooks(TEST_TENANT_ID, [
        {
          type: 'TRANSACTION',
          ruleImplementationName: 'transactions-outflow-inflow-volume',
          defaultParameters: {
            timeWindow: {
              units: 1,
              granularity: 'day',
              rollingBasis: true,
            },
            ...ruleParams,
          } as TransactionsOutflowInflowVolumeRuleParameters,
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
})

const TEST_TENANT_ID = getTestTenantId()
testAggregationRebuild(
  TEST_TENANT_ID,
  {
    type: 'TRANSACTION',
    ruleImplementationName: 'transactions-outflow-inflow-volume',
    defaultParameters: DEFAULT_RULE_PARAMETERS,
  },
  [
    getTestTransaction({
      originUserId: '1',
      destinationUserId: '2',
      type: 'TRANSFER',
      originAmountDetails: TEST_TRANSACTION_AMOUNT_100,
      destinationAmountDetails: TEST_TRANSACTION_AMOUNT_100,
      timestamp: dayjs('2022-01-01T00:00:00.000Z').valueOf(),
    }),
    getTestTransaction({
      originUserId: '1',
      destinationUserId: '12',
      type: 'TRANSFER',
      originAmountDetails: TEST_TRANSACTION_AMOUNT_100,
      destinationAmountDetails: TEST_TRANSACTION_AMOUNT_100,
      timestamp: dayjs('2022-01-01T00:10:00.000Z').valueOf(),
    }),
    getTestTransaction({
      originUserId: '2',
      destinationUserId: '1',
      type: 'TRANSFER',
      originAmountDetails: TEST_TRANSACTION_AMOUNT_100,
      destinationAmountDetails: TEST_TRANSACTION_AMOUNT_100,
      timestamp: dayjs('2022-01-01T03:00:00.000Z').valueOf(),
    }),
  ],
  {
    origin: [
      {
        inflowTransactionCount: 1,
        inflow3dsDoneTransactionCount: 1,
        inflowTransactionAmount: 100,
        hour: '2022010100',
      },
      {
        outflowTransactionCount: 1,
        outflowTransactionAmount: 100,
        outflow3dsDoneTransactionCount: 1,
        hour: '2022010103',
      },
    ],
    destination: [
      {
        outflowTransactionCount: 2,
        outflowTransactionAmount: 200,
        outflow3dsDoneTransactionCount: 2,
        hour: '2022010100',
      },
      {
        inflowTransactionCount: 1,
        inflow3dsDoneTransactionCount: 1,
        inflowTransactionAmount: 100,
        hour: '2022010103',
      },
    ],
  }
)
