import { getLogicVariableByKey } from '..'
import { ConsumerUserLogicVariable, TransactionLogicVariable } from '../types'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { dynamoDbSetupHook } from '@/test-utils/dynamodb-test-utils'
import { getTestTransaction } from '@/test-utils/transaction-test-utils'
import { getTestUser } from '@/test-utils/user-test-utils'

dynamoDbSetupHook()

test('transaction amount (w/ currency conversion)', async () => {
  const variable = getLogicVariableByKey(
    'TRANSACTION:originAmountDetails-transactionAmount'
  ) as TransactionLogicVariable
  const value = await variable.load(
    getTestTransaction({
      originAmountDetails: {
        transactionAmount: 10,
        transactionCurrency: 'EUR',
      },
    }),
    { baseCurrency: 'USD', tenantId: 'test', dynamoDb: getDynamoDbClient() }
  )

  expect(value).toBe(10.824283106705524)
})

test('transaction amount card payment details (w/ currency conversion)', async () => {
  const variable = getLogicVariableByKey(
    'TRANSACTION:originPaymentDetails-cardBalance-amountValue'
  ) as TransactionLogicVariable
  const value = await variable.load(
    getTestTransaction({
      originPaymentDetails: {
        method: 'CARD',
        cardBalance: {
          amountCurrency: 'EUR',
          amountValue: 10,
        },
      },
    }),
    { baseCurrency: 'USD', tenantId: 'test', dynamoDb: getDynamoDbClient() }
  )

  expect(value).toBe(10.824283106705524)
})

test('user transaction limit (w/ currency conversion)', async () => {
  const variable = getLogicVariableByKey(
    'CONSUMER_USER:transactionLimits-maximumDailyTransactionLimit-amountValue__BOTH'
  ) as ConsumerUserLogicVariable

  const user = getTestUser({
    transactionLimits: {
      maximumDailyTransactionLimit: {
        amountCurrency: 'EUR',
        amountValue: 10,
      },
    },
  })

  const value = await variable.load(user, {
    baseCurrency: 'USD',
    tenantId: 'test',
    dynamoDb: getDynamoDbClient(),
  })

  expect(value).toBe(10.824283106705524)
})

test('transaction amount (w/o currency conversion)', async () => {
  const variable = getLogicVariableByKey(
    'TRANSACTION:destinationAmountDetails-transactionAmount'
  ) as TransactionLogicVariable
  const value = await variable.load(
    getTestTransaction({
      destinationAmountDetails: {
        transactionAmount: 10,
        transactionCurrency: 'EUR',
      },
    }),
    { baseCurrency: 'EUR', tenantId: 'test', dynamoDb: getDynamoDbClient() }
  )

  expect(value).toBe(10)
})
