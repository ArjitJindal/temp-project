import { USERS_COLLECTION } from '@/utils/mongodb-definitions'
import { InternalUser } from '@/@types/openapi-internal/InternalUser'
import { testQuestion } from '@/services/copilot/questions/definitions/__tests__/util'
import { LinkedUsers } from '@/services/copilot/questions/definitions/linked-users'

describe('Linked users', () => {
  test('One user returned', async () => {
    await testQuestion(
      LinkedUsers,
      {},
      async (tenantId, mongoDb) => {
        const db = mongoDb.db()
        await db
          .collection<InternalUser>(USERS_COLLECTION(tenantId))
          .insertMany([
            {
              createdTimestamp: new Date().valueOf(),
              legalEntity: {
                companyGeneralDetails: {
                  legalName: 'Test user',
                },
                contactDetails: {
                  emailIds: ['test@test.com'],
                },
              },
              type: 'BUSINESS',
              userId: 'U-1',
            },
            {
              createdTimestamp: new Date().valueOf(),
              legalEntity: {
                companyGeneralDetails: {
                  legalName: 'Another user',
                },
                contactDetails: {
                  emailIds: ['test@test.com'],
                },
              },
              type: 'BUSINESS',
              userId: 'U-2',
            },
          ])
      },
      (data) => {
        expect(data.length).toEqual(1)
        expect(data.at(0)?.at(0)).toEqual('U-2')
        expect(data.at(0)?.at(1)).toEqual('Another user')
      }
    )
  })
})
