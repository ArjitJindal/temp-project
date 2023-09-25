import { TableQuestion } from '@/services/copilot/questions/types'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import { Case } from '@/@types/openapi-internal/Case'
import {
  CASES_COLLECTION,
  REPORT_COLLECTION,
} from '@/utils/mongodb-definitions'
import { Alert } from '@/@types/openapi-internal/Alert'
import { Report } from '@/@types/openapi-internal/Report'
import {
  humanReadablePeriod,
  matchPeriod,
  Period,
  periodVars,
} from '@/services/copilot/questions/definitions/util'

export const AlertsRelatedToTransaction: TableQuestion<
  {
    transactionID: string
  } & Period
> = {
  type: 'TABLE',
  questionId: 'Alerts related to transaction',
  title: (_, vars) => {
    return `Alerts related to transaction ${vars.transactionID}`
  },
  aggregationPipeline: async (
    { tenantId, username },
    { transactionID, ...period }
  ) => {
    const client = await getMongoDbClient()
    const db = client.db()
    const result = await db
      .collection<Case>(CASES_COLLECTION(tenantId))
      .aggregate<{ alerts: Alert[]; caseId: string; reports: Report[] }>([
        {
          $match: {
            ...matchPeriod('createdTimestamp', period),
            caseTransactionsIds: transactionID,
          },
        },
        {
          $project: {
            alerts: 1,
            caseId: 1,
          },
        },
        {
          $lookup: {
            from: REPORT_COLLECTION(tenantId),
            localField: 'caseId',
            foreignField: 'caseId',
            as: 'reports',
          },
        },
      ])
      .toArray()

    return {
      data: result.flatMap((r) => {
        return r.alerts.map((a) => {
          return [
            a.alertId,
            a.ruleId,
            a.ruleDescription,
            a.alertStatus,
            a.createdTimestamp,
            a.alertStatus === 'CLOSED'
              ? a.lastStatusChange?.reason?.join(', ')
              : '-',
            r.reports.map((r) => r.id).join(', '),
          ]
        })
      }),
      summary: `There have been ${
        result.flatMap((r) => r.alerts).length
      } alerts for ${username} ${humanReadablePeriod(period)}.`,
    }
  },
  headers: [
    { name: 'Alert ID', columnType: 'ID' },
    { name: 'Rule ID', columnType: 'ID' },
    { name: 'Rule description', columnType: 'STRING' },
    { name: 'Status', columnType: 'STRING' },
    { name: 'Created on', columnType: 'DATE_TIME' },
    { name: 'Closing reason', columnType: 'STRING' },
    { name: "SAR's filed", columnType: 'STRING' },
  ],
  variableOptions: {
    transactionID: {
      type: 'STRING',
      options: async (ctx) => {
        return ctx._case.caseTransactionsIds || []
      },
    },
    ...periodVars,
  },
  defaults: ({ _case }) => {
    return {
      transactionID: _case.caseTransactionsIds?.at(0) || '',
    }
  },
}
