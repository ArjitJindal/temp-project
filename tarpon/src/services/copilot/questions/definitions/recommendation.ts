import { EmbeddedQuestion } from '@/services/copilot/questions/types'

export const Recommendation: EmbeddedQuestion<{
  recommendation: string
}> = {
  type: 'EMBEDDED',
  questionId: 'Recommendation',
  categories: ['CONSUMER', 'BUSINESS'],
  title: async () => {
    return `AI Forensics Recommendation`
  },
  variableOptions: {
    recommendation: 'STRING',
  },
  defaults: () => {
    return {
      recommendation: 'AI Forensics has no recommendations.',
    }
  },
}
