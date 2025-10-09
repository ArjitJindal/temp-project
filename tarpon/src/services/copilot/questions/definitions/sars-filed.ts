import { COPILOT_QUESTIONS } from '@flagright/lib/utils'
import { TableQuestion } from '@/services/copilot/questions/types'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import { REPORT_COLLECTION, USERS_COLLECTION } from '@/utils/mongo-table-names'
import { Report } from '@/@types/openapi-internal/Report'
import { InternalUser } from '@/@types/openapi-internal/InternalUser'
import {
  humanReadablePeriod,
  matchPeriod,
  Period,
  periodVars,
} from '@/services/copilot/questions/definitions/util'

export const SarsFiled: TableQuestion<Period> = {
  type: 'TABLE',
  questionId: COPILOT_QUESTIONS.ALERTS_THAT_RESULTED_IN_SAR,
  categories: ['CONSUMER', 'BUSINESS'],
  title: async (_, vars) => {
    return `Alerts that results in SARs ${humanReadablePeriod(vars)}`
  },
  aggregationPipeline: async (
    { tenantId, userId, username, accountService },
    period
  ) => {
    const client = await getMongoDbClient()
    const db = client.db()
    const result = await db
      .collection<Report>(REPORT_COLLECTION(tenantId))
      .aggregate<Report & { user: InternalUser }>([
        {
          $match: {
            ...matchPeriod('createdAt', period),
            caseUserId: userId,
          },
        },
        {
          $lookup: {
            from: USERS_COLLECTION(tenantId),
            localField: 'caseUserId',
            foreignField: 'userId',
            as: 'user',
          },
        },
        {
          $unwind: {
            path: '$user',
          },
        },
        ...(period.sortField && period.sortOrder
          ? [
              {
                $sort: {
                  [period.sortField]: period.sortOrder === 'descend' ? -1 : 1,
                },
              },
            ]
          : []),
      ])
      .toArray()

    const accounts = await accountService.getAccounts(
      tenantId,
      result.map((r) => r.createdById)
    )
    const items = result.map((r, i) => {
      return [
        r.id,
        r.description,
        (accounts && accounts.at(i)?.name) ?? r.createdById,
        r.caseId,
        r.createdAt,
      ]
    })
    return {
      data: {
        items,
        total: items.length,
      },
      summary: `There have been ${
        result.length
      } SARs filed ${username} ${humanReadablePeriod(period)}.`,
    }
  },
  headers: [
    { name: 'SAR ID', columnType: 'ID' },
    { name: 'Description', columnType: 'STRING' },
    { name: 'Created by', columnType: 'STRING' },
    { name: 'Related case', columnType: 'ID' },
    {
      name: 'Created at',
      columnType: 'DATE_TIME',
      columnId: 'createdAt',
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
