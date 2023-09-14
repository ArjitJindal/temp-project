import { TableQuestion } from '@/services/copilot/questions/types'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import { Case } from '@/@types/openapi-internal/Case'
import { CASES_COLLECTION } from '@/utils/mongodb-definitions'

export const CaseHistory: TableQuestion<any> = {
  type: 'TABLE',
  questionId: 'Case history',
  aggregationPipeline: async ({ tenantId, userId }) => {
    const client = await getMongoDbClient()
    const db = client.db()
    const result = await db
      .collection<Case>(CASES_COLLECTION(tenantId))
      .find({
        $or: [
          { 'caseUsers.origin.userId': userId },
          { 'caseUsers.destination.userId': userId },
        ],
      })
      .toArray()

    return result.map((r) => {
      return [
        r.caseId,
        r.createdTimestamp,
        r.caseStatus,
        r.lastStatusChange?.reason?.join(', '),
      ]
    })
  },
  headers: [
    { name: 'Case ID', columnType: 'STRING' },
    { name: 'Created on', columnType: 'DATETIME' },
    { name: 'Status', columnType: 'STRING' },
    { name: 'Closing reason', columnType: 'STRING' },
  ],
  variableOptions: {},
}
