import { COPILOT_QUESTIONS } from '@flagright/lib/utils'
import { TableQuestion } from '@/services/copilot/questions/types'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import { Case } from '@/@types/openapi-internal/Case'
import { CASES_COLLECTION } from '@/utils/mongo-table-names'
import {
  calculatePercentageBreakdown,
  humanReadablePeriod,
  matchPeriod,
  casePaymentIdentifierQuery,
  Period,
  periodVars,
} from '@/services/copilot/questions/definitions/util'

export const CaseHistory: TableQuestion<Period> = {
  type: 'TABLE',
  questionId: COPILOT_QUESTIONS.CASES,
  categories: ['CONSUMER', 'BUSINESS', 'PAYMENT'],
  title: async (_params, vars) => {
    return `Cases ${humanReadablePeriod(vars)}`
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
    const result = await db
      .collection<Case>(CASES_COLLECTION(tenantId))
      .find({
        ...matchPeriod('createdTimestamp', period),
        $or: condition,
      })
      .sort(
        period.sortField && period.sortOrder
          ? { [period.sortField]: period.sortOrder === 'descend' ? -1 : 1 }
          : {}
      )
      .toArray()

    const items = result.map((r) => {
      return [
        r.caseId,
        r.createdTimestamp,
        r.caseTransactionsCount,
        r.caseStatus,
        r.updatedAt,
        r.lastStatusChange?.reason?.join(', ') || '-',
      ]
    })
    return {
      data: {
        items,
        total: items.length,
      },
      summary: `There have been ${
        result.length
      } cases for ${humanReadableId} ${humanReadablePeriod(period)}. ${
        result.length
          ? `For the cases, ${calculatePercentageBreakdown(
              result.map((c) => c.caseStatus || '')
            )}.`
          : ``
      }`,
    }
  },
  headers: [
    { name: 'Case ID', columnType: 'ID', columnId: 'caseId', sortable: true },
    {
      name: 'Created on',
      columnType: 'DATE_TIME',
      columnId: 'createdTimestamp',
      sortable: true,
    },
    {
      name: 'Transactions hit',
      columnType: 'NUMBER',
      columnId: 'caseTransactionsCount',
      sortable: true,
    },
    { name: 'Status', columnType: 'TAG' },
    {
      name: 'Last updated at',
      columnType: 'DATE_TIME',
      columnId: 'updatedAt',
      sortable: true,
    },
    { name: 'Closing reason', columnType: 'STRING' },
  ],
  variableOptions: {
    ...periodVars,
  },
  defaults: () => {
    return {}
  },
}
