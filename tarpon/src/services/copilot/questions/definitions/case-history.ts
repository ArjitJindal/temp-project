import { TableQuestion } from '@/services/copilot/questions/types'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import { Case } from '@/@types/openapi-internal/Case'
import { CASES_COLLECTION } from '@/utils/mongodb-definitions'
import {
  calculatePercentageBreakdown,
  humanReadablePeriod,
  matchPeriod,
  Period,
  periodVars,
} from '@/services/copilot/questions/definitions/util'

export const CaseHistory: TableQuestion<Period> = {
  type: 'TABLE',
  questionId: 'Cases',
  title: async ({ username }, vars) => {
    return `Cases for ${username} ${humanReadablePeriod(vars)}`
  },
  aggregationPipeline: async ({ tenantId, userId, username }, period) => {
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

    return {
      data: result.map((r) => {
        return [
          r.caseId,
          r.createdTimestamp,
          r.caseTransactionsCount,
          r.caseStatus,
          r.updatedAt,
          r.lastStatusChange?.reason?.join(', ') || '-',
        ]
      }),
      summary: `There have been ${
        result.length
      } cases for ${username} ${humanReadablePeriod(
        period
      )}. For the cases, ${calculatePercentageBreakdown(
        result.map((c) => c?.caseStatus || '')
      )}.`,
    }
  },
  headers: [
    { name: 'Case ID', columnType: 'ID' },
    { name: 'Created on', columnType: 'DATE_TIME' },
    { name: 'Transactions hit', columnType: 'NUMBER' },
    { name: 'Status', columnType: 'TAG' },
    { name: 'Last updated at', columnType: 'DATE_TIME' },
    { name: 'Closing reason', columnType: 'STRING' },
  ],
  variableOptions: {
    ...periodVars,
  },
  defaults: () => {
    return {}
  },
}
