import {
  StackedBarchartQuestion,
  TableQuestion,
  TimeseriesQuestion,
  BarchartQuestion,
  PropertiesQuestion,
  EmbeddedQuestion,
} from './types'
import { CaseHistory } from '@/services/copilot/questions/definitions/case-history'
import { TrsScore } from '@/services/copilot/questions/definitions/trs-score'
import { TransactionType } from '@/services/copilot/questions/definitions/transaction-type'
import { TransactionByRulesAction } from '@/services/copilot/questions/definitions/transaction-by-rules-action'
import { UsersSentMoneyTo } from '@/services/copilot/questions/definitions/users-sent-money-to'
import { AlertHistory } from '@/services/copilot/questions/definitions/alert-history'
import { SarsFiled } from '@/services/copilot/questions/definitions/sars-filed'
import { UsersReceivedMoneyFrom } from '@/services/copilot/questions/definitions/users-received-money-from'
import { UniquePaymentIdentifierSent } from '@/services/copilot/questions/definitions/unique-payment-identifier-sent'
import { UniquePaymentIdentifierReceived } from '@/services/copilot/questions/definitions/unique-payment-identifier-received'
import { AlertsRelatedToTransaction } from '@/services/copilot/questions/definitions/alerts-related-to-transaction'
import { TransactionLedRuleHit } from '@/services/copilot/questions/definitions/transaction-led-rule-hit'
import { Transactions } from '@/services/copilot/questions/definitions/transactions'
import { LinkedUsers } from '@/services/copilot/questions/definitions/linked-users'
import { UserDetails } from '@/services/copilot/questions/definitions/user-details'
import { Shareholders } from '@/services/copilot/questions/definitions/shareholders'
import { Directors } from '@/services/copilot/questions/definitions/directors'
import { Website } from '@/services/copilot/questions/definitions/website'
import { Linkedin } from '@/services/copilot/questions/definitions/linkedin'
import { EntityLinking } from '@/services/copilot/questions/definitions/entity-linking'
import { TransactionSummary } from '@/services/copilot/questions/definitions/transaction-summary'
import { CrmInsights } from '@/services/copilot/questions/definitions/crm-insights'
import { KycScoring } from '@/services/copilot/questions/definitions/kyc-score'
import { Recommendation } from '@/services/copilot/questions/definitions/recommendation'

export const questions: (
  | TableQuestion<any>
  | StackedBarchartQuestion<any>
  | BarchartQuestion<any>
  | TimeseriesQuestion<any>
  | PropertiesQuestion<any>
  | EmbeddedQuestion<any>
)[] = [
  AlertHistory,
  AlertsRelatedToTransaction,
  TransactionLedRuleHit,
  Transactions,
  TransactionSummary,
  CrmInsights,
  LinkedUsers,
  CaseHistory,
  SarsFiled,
  Shareholders,
  Directors,
  TransactionByRulesAction,
  TransactionType,
  TrsScore,
  UsersSentMoneyTo,
  UsersReceivedMoneyFrom,
  UniquePaymentIdentifierSent,
  UniquePaymentIdentifierReceived,
  UserDetails,
  Website,
  Linkedin,
  EntityLinking,
  KycScoring,
  Recommendation,
]

export const queries = questions.map(({ questionId, variableOptions }) => {
  return {
    questionId,
    variableOptions,
  }
})
