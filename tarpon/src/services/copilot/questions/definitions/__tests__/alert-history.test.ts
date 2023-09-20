import { CaseRepository } from '@/services/rules-engine/repositories/case-repository'
import { AlertHistory } from '@/services/copilot/questions/definitions/alert-history'
import { testQuestion } from '@/services/copilot/questions/definitions/__tests__/util'

describe('Alert history', () => {
  test('One alert returned', async () => {
    await testQuestion(
      AlertHistory,
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
          alerts: [
            {
              alertId: 'A-1',
              createdTimestamp: new Date().valueOf(),
              ruleInstanceId: '',
              ruleName: '',
              ruleDescription: '',
              ruleAction: 'ALLOW',
              ruleId: '',
              numberOfTransactionsHit: 0,
              priority: 'P1',
            },
          ],
        })
      },
      (data) => {
        expect(data.length).toEqual(1)
      }
    )
  })
})
