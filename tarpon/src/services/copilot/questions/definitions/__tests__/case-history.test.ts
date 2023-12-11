import { CaseHistory } from '@/services/copilot/questions/definitions/case-history'
import { CaseRepository } from '@/services/rules-engine/repositories/case-repository'
import { testQuestion } from '@/services/copilot/questions/definitions/__tests__/util'
import { DEFAULT_CASE_AGGREGATES } from '@/utils/case'

describe('Case history', () => {
  test('One case returned', async () => {
    await testQuestion(
      CaseHistory,
      {},
      async (tenantId, mongoDb) => {
        const cr = new CaseRepository(tenantId, {
          mongoDb,
        })
        await cr.addCaseMongo({
          caseType: 'SYSTEM',
          caseUsers: {
            origin: { userId: 'U-1' },
          },
          createdTimestamp: new Date(
            new Date().setDate(new Date().getDate() - 5)
          ).valueOf(),
          caseAggregates: DEFAULT_CASE_AGGREGATES,
        })
      },
      (data) => {
        expect(data.length).toEqual(1)
      }
    )
  })
})
