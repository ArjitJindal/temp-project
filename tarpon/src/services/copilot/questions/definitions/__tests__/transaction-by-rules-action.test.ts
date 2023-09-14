import { MongoDbTransactionRepository } from '@/services/rules-engine/repositories/mongodb-transaction-repository'
import { TransactionByRulesAction } from '@/services/copilot/questions/definitions/transaction-by-rules-action'
import { testQuestion } from '@/services/copilot/questions/definitions/__tests__/util'

describe('Transaction by rules action', () => {
  test('One transaction returned', async () => {
    await testQuestion(
      TransactionByRulesAction,
      async (tenantId, mongoDb) => {
        const tr = new MongoDbTransactionRepository(tenantId, mongoDb)
        await tr.addTransactionToMongo({
          executedRules: [],
          hitRules: [
            {
              ruleId: '',
              ruleInstanceId: '',
              ruleName: '',
              ruleDescription: '',
              ruleAction: 'SUSPEND',
            },
          ],
          status: 'ALLOW',
          timestamp: new Date().valueOf(),
          transactionId: 'T-1',
          type: 'DEPOSIT',
          originUserId: 'U-1',
        })
      },
      (data) => {
        expect(data.length).toEqual(4)
        expect(
          data.find((d) => d.label === 'SUSPEND')?.values.at(0)?.y
        ).toEqual(1)
      }
    )
  })
})
