import { COPILOT_QUESTIONS } from '@flagright/lib/utils'
import { humanizeConstant } from '@flagright/lib/utils/humanize'
import { EmbeddedQuestion } from '../types'
import { SanctionsHitStatus } from '@/@types/openapi-internal/SanctionsHitStatus'
import { SanctionsDetails } from '@/@types/openapi-internal/SanctionsDetails'

interface HitsTableQuestionProps {
  screeningDetails?: string
}

function getOptionName(details: SanctionsDetails) {
  if (!details) {
    return ''
  }
  let result = details.name
  if (details.iban) {
    result += ` (IBAN: ${details.iban})`
  }
  if (details.entityType) {
    result += ` (${humanizeConstant(details.entityType)})`
  }
  return result
}

const getHitsTableQuestion = (
  filterStatus: SanctionsHitStatus
): EmbeddedQuestion<HitsTableQuestionProps> => {
  return {
    type: 'EMBEDDED',
    variableOptions: {
      screeningDetails: {
        type: 'SCREENING_DETAIL_FILTER',
        value: ({ alert }) => {
          return (
            alert.ruleHitMeta?.sanctionsDetails?.map((detail) => ({
              label: getOptionName(detail),
              value:
                // duplicate logic to used same in frotend
                detail.hitContext?.paymentMethodId ??
                detail.searchId +
                  ' ' +
                  detail.entityType +
                  ' ' +
                  detail.searchId,
            })) ?? []
          )
        },
      },
    },
    defaults: ({ alertId, alert }) => {
      const sanctionDetail = alert.ruleHitMeta?.sanctionsDetails?.at(0)
      return {
        alertId: alertId,
        screeningDetails: sanctionDetail
          ? sanctionDetail.hitContext?.paymentMethodId ??
            sanctionDetail.searchId +
              ' ' +
              sanctionDetail.entityType +
              ' ' +
              sanctionDetail.searchId
          : undefined,
      }
    },
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
