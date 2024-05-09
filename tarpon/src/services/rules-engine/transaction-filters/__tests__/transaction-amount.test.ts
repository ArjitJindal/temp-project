import { TransactionAmountRuleFilter } from '../transaction-amount'
import { TransactionAmountRange } from '../../utils/rule-parameter-schemas'
import { getTestTenantId } from '@/test-utils/tenant-test-utils'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { getTestTransaction } from '@/test-utils/transaction-test-utils'
import { Transaction } from '@/@types/openapi-public/Transaction'
import { filterVariantsTest } from '@/test-utils/filter-test-utils'
import { dynamoDbSetupHook } from '@/test-utils/dynamodb-test-utils'

const dynamodb = getDynamoDbClient()
dynamoDbSetupHook()
interface TestCase {
  name: string
  amounts: Partial<Transaction>
  range: TransactionAmountRange
  expectedResult: boolean
}

const TEST_CASES: TestCase[] = [
  {
    name: 'Transaction origin/destination amount missing',
    amounts: {
      originAmountDetails: undefined,
      destinationAmountDetails: undefined,
    },
    range: { EUR: { min: 100, max: 200 } },
    expectedResult: false,
  },
  {
    name: 'Transaction origin amount in the range (min+max)',
    amounts: {
      originAmountDetails: {
        transactionAmount: 150,
        transactionCurrency: 'EUR',
      },
      destinationAmountDetails: undefined,
    },
    range: { EUR: { min: 100, max: 200 } },
    expectedResult: true,
  },
  {
    name: 'Transaction origin amount in the range (different currency)',
    amounts: {
      originAmountDetails: {
        transactionAmount: 150,
        transactionCurrency: 'USD',
      },
      destinationAmountDetails: undefined,
    },
    range: { EUR: { min: 100, max: 200 } },
    expectedResult: true,
  },
  {
    name: 'Transaction origin amount in the range (min)',
    amounts: {
      originAmountDetails: {
        transactionAmount: 150,
        transactionCurrency: 'EUR',
      },
      destinationAmountDetails: undefined,
    },
    range: { EUR: { min: 100 } },
    expectedResult: true,
  },
  {
    name: 'Transaction origin amount in the range (max)',
    amounts: {
      originAmountDetails: {
        transactionAmount: 150,
        transactionCurrency: 'EUR',
      },
      destinationAmountDetails: undefined,
    },
    range: { EUR: { max: 200 } },
    expectedResult: true,
  },
  {
    name: 'Transaction origin amount not in the range',
    amounts: {
      originAmountDetails: {
        transactionAmount: 50,
        transactionCurrency: 'EUR',
      },
      destinationAmountDetails: undefined,
    },
    range: { EUR: { min: 100, max: 200 } },
    expectedResult: false,
  },
  {
    name: 'Transaction destination amount in the range (min+max)',
    amounts: {
      destinationAmountDetails: {
        transactionAmount: 150,
        transactionCurrency: 'EUR',
      },
      originAmountDetails: undefined,
    },
    range: { EUR: { min: 100, max: 200 } },
    expectedResult: true,
  },
  {
    name: 'Transaction destination amount in the range (min)',
    amounts: {
      destinationAmountDetails: {
        transactionAmount: 150,
        transactionCurrency: 'EUR',
      },
      originAmountDetails: undefined,
    },
    range: { EUR: { min: 100 } },
    expectedResult: true,
  },
  {
    name: 'Transaction destination amount in the range (max)',
    amounts: {
      destinationAmountDetails: {
        transactionAmount: 150,
        transactionCurrency: 'EUR',
      },
      originAmountDetails: undefined,
    },
    range: { EUR: { max: 200 } },
    expectedResult: true,
  },
  {
    name: 'Transaction destination amount not in the range',
    amounts: {
      destinationAmountDetails: {
        transactionAmount: 50,
        transactionCurrency: 'EUR',
      },
      originAmountDetails: undefined,
    },
    range: { EUR: { min: 100, max: 200 } },
    expectedResult: false,
  },
]
filterVariantsTest({ v8: true }, () => {
  describe.each<TestCase>(TEST_CASES)(
    '',
    ({ name, amounts, range, expectedResult }) => {
      test(name, async () => {
        expect(
          await new TransactionAmountRuleFilter(
            getTestTenantId(),
            {
              transaction: getTestTransaction(amounts),
            },
            { transactionAmountRange: range },
            dynamodb
          ).predicate()
        ).toBe(expectedResult)
      })
    }
  )
})
