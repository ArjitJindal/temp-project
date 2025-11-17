import { COPILOT_QUESTIONS } from '@flagright/lib/utils'
import { TableQuestion } from '@/services/copilot/questions/types'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import { USERS_COLLECTION } from '@/utils/mongo-table-names'
import { InternalConsumerUser } from '@/@types/openapi-internal/InternalConsumerUser'
import { InternalBusinessUser } from '@/@types/openapi-internal/InternalBusinessUser'
import {
  legalEntityToRow,
  personColumns,
  personToRow,
} from '@/services/copilot/questions/definitions/common/person'
import { searchUser } from '@/services/copilot/questions/definitions/common/search'
import { queryUsername } from '@/services/copilot/questions/definitions/util'
import { isPerson } from '@/utils/helpers'

export const Shareholders: TableQuestion<{ userId: string }> = {
  type: 'TABLE',
  questionId: COPILOT_QUESTIONS.SHAREHOLDERS,
  categories: ['BUSINESS'],
  title: async (_, { userId }) => {
    return `Shareholders for ${await queryUsername(userId)}`
  },
  aggregationPipeline: async ({ tenantId }, { userId }) => {
    const client = await getMongoDbClient()
    const db = client.db()
    const result = await db
      .collection<InternalConsumerUser | InternalBusinessUser>(
        USERS_COLLECTION(tenantId)
      )
      .findOne({ userId })
    const items =
      result?.type === 'BUSINESS' && result.shareHolders
        ? result.shareHolders.map((shareHolder) =>
            isPerson(shareHolder)
              ? personToRow(shareHolder)
              : legalEntityToRow(shareHolder)
          )
        : []
    return {
      data: {
        items,
        total: items.length,
      },
      summary: ``,
    }
  },
  variableOptions: {
    userId: {
      type: 'SEARCH',
      search: searchUser,
    },
  },
  headers: personColumns,
  defaults: ({ userId }) => {
    return {
      userId,
    }
  },
}
