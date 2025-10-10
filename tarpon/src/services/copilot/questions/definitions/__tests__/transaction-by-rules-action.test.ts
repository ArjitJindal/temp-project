import { MongoDbTransactionRepository } from '@/services/rules-engine/repositories/mongodb-transaction-repository'
import { TransactionByRulesAction } from '@/services/copilot/questions/definitions/transaction-by-rules-action'
import { testQuestion } from '@/services/copilot/questions/definitions/__tests__/util'
import { getDynamoDbClient } from '@/utils/dynamodb'

describe('Transaction by rules action', () => {
  const dynamoDb = getDynamoDbClient()
  test('One transaction returned', async () => {
    await testQuestion(
      TransactionByRulesAction,
      {
        from: new Date('2020-01-01T12:00:00').valueOf(),
        to: new Date('2020-02-01T12:00:00').valueOf(),
      },
      async (tenantId, mongoDb) => {
        const tr = new MongoDbTransactionRepository(tenantId, mongoDb, dynamoDb)
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
          timestamp: new Date('2020-01-15T12:00:00').valueOf(),
          transactionId: 'T-1',
          type: 'DEPOSIT',
          originUserId: 'U-1',
        })
      },
      (data) => {
        expect(data.length).toEqual(4)
        const dataPoint = data.find((d) => d.label === 'SUSPEND')?.values.at(14)
        expect(dataPoint?.x).toEqual('2020-01-15')
        expect(dataPoint?.y).toEqual(1)
      }
    )
  })
})
