import { COPILOT_QUESTIONS } from '@flagright/lib/utils'
import { TableQuestion } from '@/services/copilot/questions/types'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import { Case } from '@/@types/openapi-internal/Case'
import { CASES_COLLECTION } from '@/utils/mongodb-definitions'
import {
  calculatePercentageBreakdown,
  humanReadablePeriod,
  matchPeriod,
  casePaymentIdentifierQuery,
  Period,
  periodVars,
} from '@/services/copilot/questions/definitions/util'

export const AlertHistory: TableQuestion<Period> = {
  type: 'TABLE',
  questionId: COPILOT_QUESTIONS.ALERTS,
  version: 2,
  categories: ['CONSUMER', 'BUSINESS', 'PAYMENT'],
  title: async (_params, vars) => {
    return `Alerts ${humanReadablePeriod(vars)}`
  },
  aggregationPipeline: async (
    { tenantId, userId, humanReadableId, paymentIdentifier },
    period
  ) => {
    const client = await getMongoDbClient()
    const db = client.db()
    const condition = userId
      ? [
          { 'caseUsers.origin.userId': userId },
          { 'caseUsers.destination.userId': userId },
        ]
      : casePaymentIdentifierQuery(paymentIdentifier)

    const pipeline: any[] = [
      {
        $match: { ...matchPeriod('createdTimestamp', period), $or: condition },
      },
      { $unwind: '$alerts' },
    ]

    if (period.sortField) {
      pipeline.push({
        $sort: {
          [`alerts.${period.sortField}`]:
            period.sortOrder === 'descend' ? -1 : 1,
        },
      })
    }

    if (period.page && period.pageSize) {
      pipeline.push({ $skip: (period.page - 1) * period.pageSize })
      pipeline.push({ $limit: period.pageSize })
    }

    const result = await db
      .collection<Case>(CASES_COLLECTION(tenantId))
      .aggregate(pipeline)
      .toArray()

    // Now, result is one document per alert (with parent case fields)
    const alerts = result.map((r) => r.alerts)
    const items = result.map((r) => {
      const a = r.alerts
      return [
        a.alertId,
        a.caseId,
        r.createdTimestamp,
        a.numberOfTransactionsHit || 0,
        a.ruleId || '',
        a.ruleName || '',
        a.ruleDescription || '',
        a.ruleAction || '',
        a.ruleNature || '',
        a.alertStatus,
        r.caseStatus,
        r.lastStatusChange?.reason?.join(', ') || '',
        a.updatedAt,
      ]
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
    { name: 'Alert ID', columnType: 'ID' },
    { name: 'Case ID', columnType: 'ID' },
    { name: 'Created on', columnType: 'DATE_TIME' },
    {
      name: '#TX',
      columnType: 'NUMBER',
      columnId: 'numberOfTransactionsHit',
      sortable: true,
    },
    { name: 'Rule ID', columnType: 'ID' },
    { name: 'Rule name', columnType: 'STRING' },
    { name: 'Rule description', columnType: 'STRING' },
    { name: 'Rule action', columnType: 'TAG' },
    { name: 'Rule nature', columnType: 'TAG' },
    { name: 'Alert status', columnType: 'TAG' },
    { name: 'Case status', columnType: 'TAG' },
    { name: 'Closing reason', columnType: 'STRING' },
    {
      name: 'Last updated at',
      columnType: 'DATE_TIME',
      columnId: 'updatedAt',
      sortable: true,
    },
  ],
  variableOptions: {
    ...periodVars,
  },
  defaults: () => {
    return {}
  },
}
