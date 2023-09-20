import { TableQuestion } from '@/services/copilot/questions/types'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import {
  REPORT_COLLECTION,
  USERS_COLLECTION,
} from '@/utils/mongodb-definitions'
import { Report } from '@/@types/openapi-internal/Report'
import { InternalUser } from '@/@types/openapi-internal/InternalUser'
import {
  humanReadablePeriod,
  matchPeriod,
  Period,
} from '@/services/copilot/questions/definitions/util'

export const SarsFiled: TableQuestion<Period> = {
  type: 'TABLE',
  questionId: 'Alerts that resulted in SAR',
  title: (_, vars) => {
    return `Alerts that results in SARs ${humanReadablePeriod(vars)}`
  },
  aggregationPipeline: async ({ tenantId, userId }, period) => {
    const client = await getMongoDbClient()
    const db = client.db()
    const result = await db
      .collection<Report>(REPORT_COLLECTION(tenantId))
      .aggregate<Report & { user: InternalUser }>([
        {
          $match: {
            ...matchPeriod('createdTimestamp', period),
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
      ])
      .toArray()

    return result.map((r) => {
      return [r.id, r.description, r.caseUserId, r.caseId]
    })
  },
  headers: [
    { name: 'SAR ID', columnType: 'ID' },
    { name: 'Description', columnType: 'STRING' },
    { name: 'Created By', columnType: 'STRING' },
    { name: 'Related case', columnType: 'ID' },
  ],
  variableOptions: {},
  defaults: () => {
    return {}
  },
}
