import { MongoDbTransactionRepository } from '@/services/rules-engine/repositories/mongodb-transaction-repository'
import { TransactionType } from '@/services/copilot/questions/definitions/transaction-type'
import { testQuestion } from '@/services/copilot/questions/definitions/__tests__/util'

describe('Transaction types', () => {
  test('One transaction type returned', async () => {
    await testQuestion(
      TransactionType,
      async (tenantId, mongoDb) => {
        const tr = new MongoDbTransactionRepository(tenantId, mongoDb)
        await tr.addTransactionToMongo({
          executedRules: [],
          hitRules: [],
          status: 'ALLOW',
          timestamp: 0,
          transactionId: 'T-1',
          type: 'DEPOSIT',
          originUserId: 'U-1',
        })
      },
      (data) => {
        expect(data.length).toEqual(1)
        expect(data.at(0)?.values.at(0)?.x).toEqual('DEPOSIT')
        expect(data.at(0)?.values.length).toEqual(1)
      }
    )
  })
})
