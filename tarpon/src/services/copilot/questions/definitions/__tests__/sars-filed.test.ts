import { SarsFiled } from '@/services/copilot/questions/definitions/sars-filed'
import { ReportRepository } from '@/services/sar/repositories/report-repository'
import { InternalUser } from '@/@types/openapi-internal/InternalUser'
import { USERS_COLLECTION } from '@/utils/mongodb-definitions'
import { testQuestion } from '@/services/copilot/questions/definitions/__tests__/util'
describe('Sars filed', () => {
  test('One sar returned', async () => {
    await testQuestion(
      SarsFiled,
      {},
      async (tenantId, mongoDb) => {
        const db = mongoDb.db()
        const rr = new ReportRepository(tenantId, mongoDb)
        await rr.saveOrUpdateReport({
          caseId: 'C-1',
          caseUserId: 'U-1',
          comments: [],
          createdAt: new Date().valueOf(),
          createdById: 'U-2',
          description: '',
          name: 'Some report',
          parameters: {},
          reportTypeId: '',
          revisions: [],
          status: 'COMPLETE',
          updatedAt: new Date().valueOf(),
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
            userId: 'U-1',
          })
      },
      (data) => {
        expect(data.length).toEqual(1)
      }
    )
  })
})
