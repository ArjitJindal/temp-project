import { COPILOT_QUESTIONS } from '@flagright/lib/utils'
import { TableQuestion } from '@/services/copilot/questions/types'
import { LinkerService } from '@/services/linker'
import { USERS_COLLECTION } from '@/utils/mongodb-definitions'
import { InternalUser } from '@/@types/openapi-internal/InternalUser'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import { getUserName } from '@/utils/helpers'
import { calculatePercentageBreakdown } from '@/services/copilot/questions/definitions/util'

export const LinkedUsers: TableQuestion<any> = {
  type: 'TABLE',
  questionId: COPILOT_QUESTIONS.LINKED_USERS,
  categories: ['CONSUMER', 'BUSINESS'],
  title: async ({ username }) => {
    return `Linked users for ${username} over the last 30 days`
  },
  aggregationPipeline: async ({ tenantId, userId, username }) => {
    const linker = new LinkerService(tenantId)
    const userIds = await linker.linkedUsers(userId ?? '')
    const client = await getMongoDbClient()
    const db = client.db()
    const result = await db
      .collection<InternalUser>(USERS_COLLECTION(tenantId))
      .find({
        userId: { $in: userIds },
      })
      .toArray()

    const items = result.map((u) => [u.userId, getUserName(u), u.type])

    return {
      data: {
        items,
        total: items.length,
      },
      summary: `There have ${
        result.length
      } users linked to ${username}. For the linked users, ${calculatePercentageBreakdown(
        result.map((u) => u?.userStateDetails?.state || '')
      )}.`,
    }
  },
  headers: [
    { name: 'User ID', columnType: 'ID' },
    { name: 'Username', columnType: 'STRING' },
    { name: 'User type', columnType: 'TAG' },
  ],
  variableOptions: {},
  defaults: () => {
    return {}
  },
}
