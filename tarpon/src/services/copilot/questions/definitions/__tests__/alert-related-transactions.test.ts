import { CaseRepository } from '@/services/rules-engine/repositories/case-repository'
import { testQuestion } from '@/services/copilot/questions/definitions/__tests__/util'
import { AlertsRelatedToTransaction } from '@/services/copilot/questions/definitions/alerts-related-to-transaction'
import { ReportRepository } from '@/services/sar/repositories/report-repository'

describe('Alerts related to transactions', () => {
  test('One alert returned', async () => {
    const createdTimestamp = new Date().valueOf()
    await testQuestion(
      AlertsRelatedToTransaction,
      {
        transactionID: 'T-1',
      },
      async (tenantId, mongoDb) => {
        const cr = new CaseRepository(tenantId, {
          mongoDb,
        })
        const c = await cr.addCaseMongo({
          caseType: 'SYSTEM',
          caseTransactionsIds: ['T-1'],
          caseUsers: {
            origin: { userId: 'U-1' },
          },
          createdTimestamp: new Date(
            new Date().setDate(new Date().getDate() - 5)
          ).valueOf(),
          alerts: [
            {
              alertId: 'A-1',
              createdTimestamp,
              ruleInstanceId: '',
              ruleName: '',
              ruleDescription: 'Transaction amount too high',
              ruleAction: 'ALLOW',
              ruleId: 'R-1',
              numberOfTransactionsHit: 0,
              priority: 'P1',
              alertStatus: 'CLOSED',
              lastStatusChange: {
                userId: '',
                timestamp: 0,
                reason: ['False positive'],
              },
            },
          ],
        })
        const rr = new ReportRepository(tenantId, mongoDb)
        await rr.saveOrUpdateReport({
          caseId: c.caseId || '',
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
      },
      (data) => {
        expect(data.length).toEqual(1)
        expect(data.at(0)).toEqual([
          'A-1',
          'R-1',
          'Transaction amount too high',
          'CLOSED',
          createdTimestamp,
          'False positive',
          'RP-1',
        ])
      }
    )
  })
})
