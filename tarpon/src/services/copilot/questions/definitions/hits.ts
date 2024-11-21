import { COPILOT_QUESTIONS } from '@flagright/lib/utils'
import { EmbeddedQuestion } from '../types'
import { searchAlert } from './common/search'
import { SanctionsHitStatus } from '@/@types/openapi-internal/SanctionsHitStatus'

interface HitsTableQuestionProps {
  alertId: string
}

const getHitsTableQuestion = (
  filterStatus: SanctionsHitStatus
): EmbeddedQuestion<HitsTableQuestionProps> => {
  return {
    type: 'EMBEDDED',
    variableOptions: {
      alertId: { type: 'SEARCH', search: searchAlert },
    },
    defaults: (ctx) => ({
      alertId: ctx.alertId,
    }),

    categories: ['CONSUMER', 'BUSINESS'],
    questionId:
      filterStatus === 'CLEARED'
        ? COPILOT_QUESTIONS.CLEARED_HITS
        : COPILOT_QUESTIONS.OPEN_HITS,
    version: 1,
    skipCache: true,
    title: async () => {
      return filterStatus === 'CLEARED' ? 'Cleared hits' : 'Human review'
    },
  }
}

export const ClearedHits: EmbeddedQuestion<HitsTableQuestionProps> =
  getHitsTableQuestion('CLEARED')

export const OpenHits: EmbeddedQuestion<HitsTableQuestionProps> =
  getHitsTableQuestion('OPEN')
