import { TableQuestion } from '@/services/copilot/questions/types'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import {
  TRANSACTIONS_COLLECTION,
  USERS_COLLECTION,
} from '@/utils/mongodb-definitions'
import { InternalTransaction } from '@/@types/openapi-internal/InternalTransaction'
import { InternalUser } from '@/@types/openapi-internal/InternalUser'
import { getUserName } from '@/utils/helpers'
import {
  humanReadablePeriod,
  matchPeriod,
  Period,
  periodVars,
} from '@/services/copilot/questions/definitions/util'

export const UsersReceivedMoneyFrom: TableQuestion<Period & { top: number }> = {
  type: 'TABLE',
  questionId: 'Users money received from',
  title: (_, vars) => {
    return `Top ${
      vars.top
    } users they have received money ${humanReadablePeriod(vars)}`
  },
  aggregationPipeline: async ({ tenantId, userId }, { top, ...period }) => {
    const client = await getMongoDbClient()
    const db = client.db()
    const result = await db
      .collection<InternalTransaction>(TRANSACTIONS_COLLECTION(tenantId))
      .aggregate<{ user: InternalUser }>([
        {
          $match: {
            destinationUserId: userId,
            ...matchPeriod('timestamp', period),
          },
        },
        {
          $sortByCount: '$originUserId',
        },
        {
          $limit: top,
        },
        {
          $lookup: {
            from: USERS_COLLECTION(tenantId),
            localField: '_id',
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
      return [r.user.userId, getUserName(r.user), r.user.type]
    })
  },
  headers: [
    { name: 'User ID', columnType: 'ID' },
    { name: 'Username', columnType: 'STRING' },
    { name: 'User type', columnType: 'STRING' },
  ],
  variableOptions: {
    ...periodVars,
    top: 'INTEGER',
  },
  defaults: () => {
    return { top: 10 }
  },
}
