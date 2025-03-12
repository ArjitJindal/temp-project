import { MongoDbTransactionRepository } from '@/services/rules-engine/repositories/mongodb-transaction-repository'
import { TransactionType } from '@/services/copilot/questions/definitions/transaction-type'
import { testQuestion } from '@/services/copilot/questions/definitions/__tests__/util'
import { withFeaturesToggled } from '@/test-utils/feature-test-utils'
import { getDynamoDbClient } from '@/utils/dynamodb'

withFeaturesToggled([], ['CLICKHOUSE_ENABLED'], () => {
  const dynamoDb = getDynamoDbClient()
  describe('Transaction types', () => {
    test('One transaction type returned', async () => {
      await testQuestion(
        TransactionType,
        {},
        async (tenantId, mongoDb) => {
          const tr = new MongoDbTransactionRepository(
            tenantId,
            mongoDb,
            dynamoDb
          )
          await tr.addTransactionToMongo({
            executedRules: [],
            hitRules: [],
            status: 'ALLOW',
            transactionId: 'T-1',
            type: 'DEPOSIT',
            originUserId: 'U-1',
            timestamp: new Date().valueOf(),
          })
        },
        (data) => {
          expect(data.length).toEqual(1)
          expect(data.at(0)?.x).toEqual('DEPOSIT')
        }
      )
    })
  })
})
