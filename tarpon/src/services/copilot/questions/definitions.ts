import { Question } from './types'
import { ClearedHits, OpenHits } from './definitions/hits'
import { CardMerchantIdentifier } from './definitions/merchant-identifier'
import { CaseHistory } from '@/services/copilot/questions/definitions/case-history'
import { TransactionAggregations } from '@/services/copilot/questions/definitions/transaction-aggregations'
import { TransactionType } from '@/services/copilot/questions/definitions/transaction-type'
import { TransactionByRulesAction } from '@/services/copilot/questions/definitions/transaction-by-rules-action'
import { AlertHistory } from '@/services/copilot/questions/definitions/alert-history'
import { SarsFiled } from '@/services/copilot/questions/definitions/sars-filed'
import { UsersTransactedWith } from '@/services/copilot/questions/definitions/users-transacted-with'
import { UniquePaymentIdentifier } from '@/services/copilot/questions/definitions/unique-payment-identifier'
import { AlertsRelatedToTransaction } from '@/services/copilot/questions/definitions/alerts-related-to-transaction'
import { CheckedTransactions } from '@/services/copilot/questions/definitions/checked-transactions'
import { TransactionQuestions } from '@/services/copilot/questions/definitions/transactions'
import { LinkedUsers } from '@/services/copilot/questions/definitions/linked-users'
import { UserDetails } from '@/services/copilot/questions/definitions/user-details'
import { Shareholders } from '@/services/copilot/questions/definitions/shareholders'
import { Directors } from '@/services/copilot/questions/definitions/directors'
import { EntityLinking } from '@/services/copilot/questions/definitions/entity-linking'
import { TransactionSummary } from '@/services/copilot/questions/definitions/transaction-summary'
import { CrmInsights } from '@/services/copilot/questions/definitions/crm-insights'
import { KycScoring } from '@/services/copilot/questions/definitions/kyc-score'
import { Recommendation } from '@/services/copilot/questions/definitions/recommendation'
import { hasFeature } from '@/core/utils/context'
import { envIsNot } from '@/utils/env'
import { isDemoMode } from '@/utils/demo'
import { ReferenceWordCount } from '@/services/copilot/questions/definitions/reference-word-count'
import { RuleHit } from '@/services/copilot/questions/definitions/rules'
export const isValidQuestion = (questionId: string) =>
  !!getQuestions().find((q) => q.questionId === questionId)

export const getQuestion = (questionId: string): Question<any> => {
  const q = getQuestions().find((q) => q.questionId === questionId)
  if (!q) {
    throw new Error('No question')
  }
  return q
}

export const getQuestions = (): Question<any>[] =>
  [
    AlertHistory,
    AlertsRelatedToTransaction,
    CaseHistory,
    Directors,
    KycScoring,
    Shareholders,
    UserDetails,
    UniquePaymentIdentifier,
    UsersTransactedWith,
    TransactionSummary,
    ReferenceWordCount,
    RuleHit,
    CardMerchantIdentifier,
    ...TransactionAggregations,
    ...TransactionQuestions,
    ...(hasFeature('CRM') ? [CrmInsights] : []),
    ...(hasFeature('SAR') ? [SarsFiled] : []),
    ...(hasFeature('ENTITY_LINKING') ? [LinkedUsers, EntityLinking] : []),
    ...(envIsNot('prod') && isDemoMode()
      ? [CheckedTransactions, Recommendation]
      : []),
    ...(envIsNot('prod') ? [TransactionByRulesAction, TransactionType] : []),
    ...(hasFeature('SANCTIONS') ? [OpenHits, ClearedHits] : []),
  ].sort((a, b) => a.questionId.localeCompare(b.questionId))

export const getQueries = () =>
  getQuestions().map(({ questionId, variableOptions }) => {
    return {
      questionId,
      variableOptions,
    }
  })
