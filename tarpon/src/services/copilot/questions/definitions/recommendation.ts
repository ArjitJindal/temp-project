import { searchAlert } from './common/search'
import { EmbeddedQuestion } from '@/services/copilot/questions/types'

export const Recommendation: EmbeddedQuestion<{ alertId: string }> = {
  type: 'EMBEDDED',
  questionId: 'Recommendation',
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
