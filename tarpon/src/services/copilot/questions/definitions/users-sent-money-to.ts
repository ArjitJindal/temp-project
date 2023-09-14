import { TableQuestion } from '@/services/copilot/questions/types'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import {
  TRANSACTIONS_COLLECTION,
  USERS_COLLECTION,
} from '@/utils/mongodb-definitions'
import { InternalTransaction } from '@/@types/openapi-internal/InternalTransaction'
import { InternalUser } from '@/@types/openapi-internal/InternalUser'
import { getUserName } from '@/utils/helpers'

export const UsersSentMoneyTo: TableQuestion<any> = {
  type: 'TABLE',
  questionId: 'Who are the top 10 users they have sent money to?',
  aggregationPipeline: async ({ tenantId, userId }) => {
    const client = await getMongoDbClient()
    const db = client.db()
    const result = await db
      .collection<InternalTransaction>(TRANSACTIONS_COLLECTION(tenantId))
      .aggregate<{ user: InternalUser }>([
        {
          $match: { originUserId: userId },
        },
        {
          $sortByCount: '$destinationUserId',
        },
        {
          $limit: 10,
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
    { name: 'User ID', columnType: 'STRING' },
    { name: 'Username', columnType: 'STRING' },
    { name: 'User type', columnType: 'STRING' },
  ],
  variableOptions: {},
}
