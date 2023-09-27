import { EmbeddedQuestion } from '@/services/copilot/questions/types'
import { searchUser } from '@/services/copilot/questions/definitions/common/search'

export const EntityLinking: EmbeddedQuestion<{ userId: string }> = {
  type: 'EMBEDDED',
  questionId: 'Entity linking',
  title: (_, { userId }) => {
    return `Entity linking for ${userId}`
  },
  variableOptions: {
    userId: {
      type: 'SEARCH',
      search: searchUser,
    },
  },
  defaults: ({ userId }) => {
    return {
      userId,
    }
  },
}
