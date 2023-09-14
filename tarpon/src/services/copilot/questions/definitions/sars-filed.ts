import { TableQuestion } from '@/services/copilot/questions/types'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import {
  REPORT_COLLECTION,
  USERS_COLLECTION,
} from '@/utils/mongodb-definitions'
import { Report } from '@/@types/openapi-internal/Report'
import { InternalUser } from '@/@types/openapi-internal/InternalUser'

export const SarsFiled: TableQuestion<any> = {
  type: 'TABLE',
  questionId: 'Which alerts have resulted in SARs?',
  aggregationPipeline: async ({ tenantId, userId }) => {
    const client = await getMongoDbClient()
    const db = client.db()
    const result = await db
      .collection<Report>(REPORT_COLLECTION(tenantId))
      .aggregate<Report & { user: InternalUser }>([
        {
          $match: {
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
      return [r.id, r.name, r.caseUserId, r.caseId]
    })
  },
  headers: [
    { name: 'SAR ID', columnType: 'STRING' },
    { name: 'Description', columnType: 'DATETIME' },
    { name: 'Created By', columnType: 'STRING' },
    { name: 'Related case', columnType: 'STRING' },
  ],
  variableOptions: {},
}
