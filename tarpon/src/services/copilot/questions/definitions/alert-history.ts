import { TableQuestion } from '@/services/copilot/questions/types'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import { Case } from '@/@types/openapi-internal/Case'
import { CASES_COLLECTION } from '@/utils/mongodb-definitions'

export const AlertHistory: TableQuestion<any> = {
  type: 'TABLE',
  questionId: 'Alert history',
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

    return result.flatMap((r) => {
      return (
        r.alerts?.map((a) => [
          a.alertId,
          r.createdTimestamp,
          r.caseStatus,
          r.lastStatusChange?.reason?.join(', '),
        ]) || []
      )
    })
  },
  headers: [
    { name: 'Alert ID', columnType: 'STRING' },
    { name: 'Created on', columnType: 'DATETIME' },
    { name: 'Status', columnType: 'STRING' },
    { name: 'Closing reason', columnType: 'STRING' },
  ],
  variableOptions: {},
}
