import { getRuleVariableByKey } from '..'
import { TransactionRuleVariable } from '../types'
import { dynamoDbSetupHook } from '@/test-utils/dynamodb-test-utils'
import { getTestTransaction } from '@/test-utils/transaction-test-utils'

dynamoDbSetupHook()

test('transaction amount (w/ currency conversion)', async () => {
  const variable = getRuleVariableByKey(
    'TRANSACTION:originAmountDetails-transactionAmount'
  ) as TransactionRuleVariable
  const value = await variable.load(
    getTestTransaction({
      originAmountDetails: {
        transactionAmount: 10,
        transactionCurrency: 'EUR',
      },
    }),
    { baseCurrency: 'USD' }
  )

  expect(value).toBe(10.685660242529654)
})

test('transaction amount (w/o currency conversion)', async () => {
  const variable = getRuleVariableByKey(
    'TRANSACTION:destinationAmountDetails-transactionAmount'
  ) as TransactionRuleVariable
  const value = await variable.load(
    getTestTransaction({
      destinationAmountDetails: {
        transactionAmount: 10,
        transactionCurrency: 'EUR',
      },
    }),
    { baseCurrency: 'EUR' }
  )

  expect(value).toBe(10)
})
