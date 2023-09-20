import { InternalTransaction } from '@/@types/openapi-internal/InternalTransaction'
import { TRANSACTIONS_COLLECTION } from '@/utils/mongodb-definitions'
import { UniquePaymentIdentifierSent } from '@/services/copilot/questions/definitions/unique-payment-identifier-sent'
import { testQuestion } from '@/services/copilot/questions/definitions/__tests__/util'

describe('Unique payment identifier sent', () => {
  test('One payment identifier returned', async () => {
    await testQuestion(
      UniquePaymentIdentifierSent,
      {},

      async (tenantId, mongoDb) => {
        const db = mongoDb.db()
        await db
          .collection<InternalTransaction>(TRANSACTIONS_COLLECTION(tenantId))
          .insertOne({
            executedRules: [],
            hitRules: [],
            status: 'ALLOW',
            timestamp: new Date().valueOf(),
            transactionId: 'T-1',
            originUserId: 'U-1',
            destinationUserId: 'U-2',
            destinationPaymentMethodId: '1',
            destinationPaymentDetails: {
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
