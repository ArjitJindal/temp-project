import { InternalTransaction } from '@/@types/openapi-internal/InternalTransaction'
import { TRANSACTIONS_COLLECTION } from '@/utils/mongodb-definitions'
import { UniquePaymentIdentifierReceived } from '@/services/copilot/questions/definitions/unique-payment-identifier-received'
import { testQuestion } from '@/services/copilot/questions/definitions/__tests__/util'

describe('Unique payment identifier received', () => {
  test.skip('One payment identifier returned', async () => {
    await testQuestion(
      UniquePaymentIdentifierReceived,
      {},

      async (tenantId, mongoDb) => {
        const db = mongoDb.db()
        await db
          .collection<InternalTransaction>(TRANSACTIONS_COLLECTION(tenantId))
          .insertOne({
            type: 'TRANSFER',
            executedRules: [],
            hitRules: [],
            status: 'ALLOW',
            timestamp: new Date().valueOf(),
            transactionId: 'T-1',
            originUserId: 'U-2',
            destinationUserId: 'U-1',
            originPaymentMethodId: '1',
            originPaymentDetails: {
              method: 'CARD',
            },
          })
      },
      (data) => {
        expect(data.length).toEqual(1)
        expect(data.at(0)?.at(0)).toEqual('1')
      }
    )
  })
})
