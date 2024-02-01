import { COPILOT_QUESTIONS } from '@flagright/lib/utils'
import { searchAlert } from './common/search'
import { EmbeddedQuestion } from '@/services/copilot/questions/types'

export const Recommendation: EmbeddedQuestion<{ alertId: string }> = {
  type: 'EMBEDDED',
  questionId: COPILOT_QUESTIONS.RECOMMENDATION,
  categories: ['CONSUMER', 'BUSINESS'],
  title: async (_, { alertId }) => {
    return `AI Forensics Recommendation for ${alertId}`
  },
  variableOptions: {
    alertId: { type: 'SEARCH', search: searchAlert },
  },
  defaults: ({ alertId }) => {
    return { alertId }
  },
}
