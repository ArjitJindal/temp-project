import { v4 as uuid } from 'uuid'
import { makeTestRequest } from '../test-utils/request'
import { Transaction } from '@/@types/openapi-internal/Transaction'
import { getTestTransaction } from '@/test-utils/transaction-test-utils'
import { TransactionMonitoringResult } from '@/@types/openapi-public/TransactionMonitoringResult'

describe('Transaction Post', () => {
  test('should return 200', async () => {
    const timestamp = Date.now()
    const transactionId = uuid()

    const transaction = getTestTransaction({
      transactionId,
      timestamp,
      originUserId: '1',
      destinationUserId: '3',
    })

    const response = await makeTestRequest<
      TransactionMonitoringResult,
      Transaction
    >('transactions', transaction)

    expect(response.status).toBe(200)
    expect(response.message).toBe('OK')
    expect(response.data?.executedRules.length).toBeGreaterThanOrEqual(1)
    expect(response.data?.executedRules[0].ruleId).not.toBeUndefined()
    expect(response.data?.hitRules.length).toBeGreaterThanOrEqual(1)
    expect(response.data?.hitRules[0].ruleId).not.toBeUndefined()
  })
})
