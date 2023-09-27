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

export const AlertHistory: TableQuestion<Period> = {
  type: 'TABLE',
  questionId: 'Alerts',
  title: (_, vars) => {
    return `Alerts for this user ${humanReadablePeriod(vars)}`
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

    const alerts = result.flatMap((r) => r.alerts)
    return {
      data: result.flatMap((r) => {
        return (
          r.alerts?.map((a) => [
            a.alertId,
            r.createdTimestamp,
            a.numberOfTransactionsHit,
            a.ruleId,
            a.ruleName,
            a.ruleDescription,
            a.ruleAction,
            a.ruleNature,
            a.alertStatus,
            r.caseStatus,
            r.lastStatusChange?.reason?.join(', '),
            a.updatedAt,
          ]) || []
        )
      }),
      summary: `There have been ${
        alerts.length
      } alerts for ${username} ${humanReadablePeriod(
        period
      )}. For the alerts, ${calculatePercentageBreakdown(
        alerts.map((a) => a?.alertStatus || '')
      )}.`,
    }
  },
  headers: [
    { name: 'Alert ID', columnType: 'ID' },
    { name: 'Created on', columnType: 'DATE_TIME' },
    { name: '#TX', columnType: 'NUMBER' },
    { name: 'Rule ID', columnType: 'ID' },
    { name: 'Rule name', columnType: 'STRING' },
    { name: 'Rule description', columnType: 'STRING' },
    { name: 'Rule action', columnType: 'TAG' },
    { name: 'Rule nature', columnType: 'TAG' },
    { name: 'Alert status', columnType: 'TAG' },
    { name: 'Case status', columnType: 'TAG' },
    { name: 'Closing reason', columnType: 'STRING' },
    { name: 'Last updated at', columnType: 'DATE_TIME' },
  ],
  variableOptions: {
    ...periodVars,
  },
  defaults: () => {
    return {}
  },
}
