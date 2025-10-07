import { COPILOT_QUESTIONS } from '@flagright/lib/utils'
import { TableQuestion } from '@/services/copilot/questions/types'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import { Case } from '@/@types/openapi-internal/Case'
import { CASES_COLLECTION, REPORT_COLLECTION } from '@/utils/mongo-table-names'
import { Alert } from '@/@types/openapi-internal/Alert'
import { Report } from '@/@types/openapi-internal/Report'
import {
  calculatePercentageBreakdown,
  humanReadablePeriod,
  matchPeriod,
  Period,
  periodVars,
} from '@/services/copilot/questions/definitions/util'

export const AlertsRelatedToTransaction: TableQuestion<
  {
    transactionId: string
  } & Period
> = {
  type: 'TABLE',
  questionId: COPILOT_QUESTIONS.ALERTS_RELATED_TO_TRANSACTION,
  version: 2,
  categories: ['CONSUMER', 'BUSINESS', 'PAYMENT'],
  title: async (_, vars) => {
    return `Alerts related to transaction ${
      vars.transactionId
    } ${humanReadablePeriod(vars)}`
  },
  aggregationPipeline: async (
    { tenantId, humanReadableId },
    { transactionId, sortField, sortOrder, ...period }
  ) => {
    const client = await getMongoDbClient()
    const db = client.db()

    const pipeline: any[] = [
      {
        $match: {
          ...matchPeriod('createdTimestamp', period),
          caseTransactionsIds: transactionId,
        },
      },
    ]

    if (sortField && sortOrder) {
      pipeline.push({
        $sort: { [sortField]: sortOrder === 'descend' ? -1 : 1 },
      })
    }

    pipeline.push(
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
      }
    )

    const result = await db
      .collection<Case>(CASES_COLLECTION(tenantId))
      .aggregate<{ alerts: Alert[]; caseId: string; reports: Report[] }>(
        pipeline
      )
      .toArray()

    const alerts = result.flatMap((r) => r.alerts)
    const items = result.flatMap((r) => {
      return r.alerts.map((a) => {
        return [
          a.alertId,
          a.caseId,
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
    })
    return {
      data: {
        items,
        total: items.length,
      },
      summary: `There have been ${
        alerts.length
      } alerts for ${humanReadableId} ${humanReadablePeriod(period)}. ${
        alerts.length
          ? `For the alerts, ${calculatePercentageBreakdown(
              alerts.map((a) => a?.alertStatus || '')
            )}.`
          : ``
      }`,
    }
  },
  headers: [
    { name: 'Alert ID', columnType: 'ID', columnId: 'alertId', sortable: true },
    { name: 'Case ID', columnType: 'ID', columnId: 'caseId', sortable: true },
    { name: 'Rule ID', columnType: 'ID', columnId: 'ruleId', sortable: true },
    { name: 'Rule description', columnType: 'STRING' },
    { name: 'Status', columnType: 'STRING' },
    {
      name: 'Created on',
      columnType: 'DATE_TIME',
      columnId: 'timestamp',
      sortable: true,
    },
    { name: 'Closing reason', columnType: 'STRING' },
    { name: "SAR's filed", columnType: 'STRING' },
  ],
  variableOptions: {
    transactionId: {
      type: 'AUTOCOMPLETE',
      options: async (ctx) => {
        return ctx._case.caseTransactionsIds || []
      },
    },
    ...periodVars,
  },
  defaults: ({ _case }) => {
    return {
      transactionId: _case.caseTransactionsIds?.at(0) || '',
    }
  },
}
