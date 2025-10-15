import { COPILOT_QUESTIONS } from '@flagright/lib/utils'
import { EmbeddedQuestion } from '@/services/copilot/questions/types'
import { searchUser } from '@/services/copilot/questions/definitions/common/search'
import { queryUsername } from '@/services/copilot/questions/definitions/util'

export const EntityLinking: EmbeddedQuestion<{ userId: string }> = {
  type: 'EMBEDDED',
  questionId: COPILOT_QUESTIONS.ONTOLOGY,
  categories: ['CONSUMER', 'BUSINESS'],
  title: async (_, { userId }) => {
    return `Ontology for ${await queryUsername(userId)}`
  },
  variableOptions: {
    userId: { type: 'SEARCH', search: searchUser },
  },
  defaults: ({ userId = '' }) => {
    return { userId }
  },
}
