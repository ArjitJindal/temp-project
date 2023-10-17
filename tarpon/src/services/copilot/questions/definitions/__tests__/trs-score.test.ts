import { TrsScore } from '@/services/copilot/questions/definitions/trs-score'
import { InternalTransaction } from '@/@types/openapi-internal/InternalTransaction'
import { TRANSACTIONS_COLLECTION } from '@/utils/mongodb-definitions'
import { testQuestion } from '@/services/copilot/questions/definitions/__tests__/util'

describe('Average TRS score', () => {
  test('Average TRS score returned', async () => {
    await testQuestion(
      TrsScore,
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
            originUserId: 'U-1',
            arsScore: {
              createdAt: new Date().valueOf(),
              arsScore: 90,
            },
          })
      },
      (data) => {
        expect(data.at(0)?.values.length).toEqual(31)
        expect(data.at(0)?.values.at(30)?.value).toEqual(90)
      }
    )
  })
})
