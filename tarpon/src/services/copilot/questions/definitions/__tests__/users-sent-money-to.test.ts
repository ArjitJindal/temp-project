import { InternalTransaction } from '@/@types/openapi-internal/InternalTransaction'
import {
  TRANSACTIONS_COLLECTION,
  USERS_COLLECTION,
} from '@/utils/mongodb-definitions'
import { InternalUser } from '@/@types/openapi-internal/InternalUser'
import { testQuestion } from '@/services/copilot/questions/definitions/__tests__/util'
import { UsersSentMoneyTo } from '@/services/copilot/questions/definitions/users-sent-money-to'

describe('User sent money to', () => {
  test('One user returned', async () => {
    await testQuestion(
      UsersSentMoneyTo,
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
            arsScore: {
              createdAt: new Date().valueOf(),
              arsScore: 90,
            },
          })
        await db
          .collection<InternalUser>(USERS_COLLECTION(tenantId))
          .insertOne({
            createdTimestamp: new Date().valueOf(),
            legalEntity: {
              companyGeneralDetails: {
                legalName: 'Test user',
              },
            },
            type: 'BUSINESS',
            userId: 'U-2',
          })
      },
      (data) => {
        expect(data.length).toEqual(1)
        expect(data.at(0)?.at(0)).toEqual('U-2')
      }
    )
  })
})
