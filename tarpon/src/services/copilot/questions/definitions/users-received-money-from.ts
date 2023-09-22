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
  aggregationPipeline: async (
    { tenantId, userId, username },
    { top, ...period }
  ) => {
    const client = await getMongoDbClient()
    const db = client.db()
    const result = await db
      .collection<InternalTransaction>(TRANSACTIONS_COLLECTION(tenantId))
      .aggregate<{ user: InternalUser; count: number; amount: number }>([
        {
          $match: {
            destinationUserId: userId,
            ...matchPeriod('timestamp', period),
          },
        },
        {
          $group: {
            _id: '$originUserId',
            count: { $sum: 1 },
            amount: { $sum: '$originAmountDetails.transactionAmount' },
          },
        },
        {
          $sort: {
            count: -1, // Sort by count in descending order
          },
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

    return {
      data: result.map((r) => {
        return [
          r.user.userId,
          getUserName(r.user),
          r.user.type,
          r.count,
          r.amount,
        ]
      }),
      summary: `The top user that ${username} sent money to was ${getUserName(
        result.at(0)?.user
      )}.`,
    }
  },
  headers: [
    { name: 'User ID', columnType: 'ID' },
    { name: 'Username', columnType: 'STRING' },
    { name: 'User type', columnType: 'STRING' },
    { name: 'Transaction Count', columnType: 'NUMBER' },
    { name: 'Total Amount', columnType: 'NUMBER' },
  ],
  variableOptions: {
    ...periodVars,
    top: 'INTEGER',
  },
  defaults: () => {
    return { top: 10 }
  },
}
