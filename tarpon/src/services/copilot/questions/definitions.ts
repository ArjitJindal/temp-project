import {
  StackedBarchartQuestion,
  TableQuestion,
  TimeseriesQuestion,
  BarchartQuestion,
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

export const questions: (
  | TableQuestion<any>
  | StackedBarchartQuestion<any>
  | BarchartQuestion<any>
  | TimeseriesQuestion<any>
)[] = [
  AlertHistory,
  AlertsRelatedToTransaction,
  TransactionLedRuleHit,
  CaseHistory,
  SarsFiled,
  TransactionByRulesAction,
  TransactionType,
  TrsScore,
  UsersSentMoneyTo,
  UsersReceivedMoneyFrom,
  UniquePaymentIdentifierSent,
  UniquePaymentIdentifierReceived,
]
