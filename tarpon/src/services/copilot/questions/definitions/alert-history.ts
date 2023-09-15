import { TableQuestion } from '@/services/copilot/questions/types'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import { Case } from '@/@types/openapi-internal/Case'
import { CASES_COLLECTION } from '@/utils/mongodb-definitions'
import {
  humanReadablePeriod,
  Period,
  periodDefaults,
  periodVars,
} from '@/services/copilot/questions/definitions/util'

export const AlertHistory: TableQuestion<Period> = {
  type: 'TABLE',
  questionId: 'Alert history',
  title: (vars) => {
    return `Alerts for this user for ${humanReadablePeriod(vars)}`
  },
  aggregationPipeline: async ({ tenantId, userId }, { from, to }) => {
    const client = await getMongoDbClient()
    const db = client.db()
    const result = await db
      .collection<Case>(CASES_COLLECTION(tenantId))
      .find({
        createdTimestamp: { $gte: from, $lte: to },
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
  variableOptions: {
    ...periodVars,
  },
  defaults: () => {
    return periodDefaults()
  },
}
