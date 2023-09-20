import { TableQuestion } from '@/services/copilot/questions/types'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import { Case } from '@/@types/openapi-internal/Case'
import { CASES_COLLECTION } from '@/utils/mongodb-definitions'
import {
  humanReadablePeriod,
  matchPeriod,
  Period,
  periodVars,
} from '@/services/copilot/questions/definitions/util'

export const AlertHistory: TableQuestion<Period> = {
  type: 'TABLE',
  questionId: 'Alert history',
  title: (_, vars) => {
    return `Alerts for this user ${humanReadablePeriod(vars)}`
  },
  aggregationPipeline: async ({ tenantId, userId }, period) => {
    const client = await getMongoDbClient()
    const db = client.db()
    const result = await db
      .collection<Case>(CASES_COLLECTION(tenantId))
      .find({
        ...matchPeriod('createdTimestamp', period),
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
    { name: 'Alert ID', columnType: 'ID' },
    { name: 'Created on', columnType: 'DATE_TIME' },
    { name: 'Status', columnType: 'STRING' },
    { name: 'Closing reason', columnType: 'STRING' },
  ],
  variableOptions: {
    ...periodVars,
  },
  defaults: () => {
    return {}
  },
}
