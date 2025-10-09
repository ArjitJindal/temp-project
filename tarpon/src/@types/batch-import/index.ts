import { Business } from '../openapi-public/Business'
import { BusinessUserEvent } from '../openapi-public/BusinessUserEvent'
import { ConsumerUserEvent } from '../openapi-public/ConsumerUserEvent'
import { Transaction } from '../openapi-public/Transaction'
import { TransactionEvent } from '../openapi-public/TransactionEvent'
import { TransactionRiskScoringResult } from '../openapi-public/TransactionRiskScoringResult'
import { User } from '../openapi-public/User'
import { UserType } from '../user/user-type'

export type TransactionValidationOptions = {
  validateOriginUserId?: boolean
  validateDestinationUserId?: boolean
}

export type BatchEntity =
  | 'TRANSACTION_BATCH'
  | 'TRANSACTION_EVENT_BATCH'
  | 'USER_BATCH'
  | 'USER_EVENT_BATCH'

export type AsyncRuleRecordTransaction = {
  type: 'TRANSACTION'
  transaction: Transaction
  senderUser?: User | Business
  receiverUser?: User | Business
  riskDetails?: TransactionRiskScoringResult
  backfillNamespace?: string
}

type AsyncRuleRecordTransactionBatch = {
  type: 'TRANSACTION_BATCH'
  transaction: Transaction
}

export type AsyncRuleRecordTransactionEvent = {
  type: 'TRANSACTION_EVENT'
  updatedTransaction: Transaction
  senderUser?: User | Business
  receiverUser?: User | Business
  transactionEventId: string
}
type AsyncRuleRecordTransactionEventBatch = {
  type: 'TRANSACTION_EVENT_BATCH'
  transactionEvent: TransactionEvent
  originUserId?: string
  destinationUserId?: string
}
type UserParameters = {
  lockCraRiskLevel?: boolean
  lockKycRiskLevel?: boolean
}
type AsyncRuleRecordUser = {
  type: 'USER'
  userType: UserType
  user: User | Business
}

export type AsyncRuleRecordUserBatch = {
  type: 'USER_BATCH'
  userType: UserType
  user: User | Business
  parameters?: UserParameters
}
type AsyncRuleRecordUserEvent = {
  type: 'USER_EVENT'
  updatedUser: User | Business
  userEventTimestamp: number
  userType: UserType
}

export type AsyncRuleRecordUserEventBatch = {
  type: 'USER_EVENT_BATCH'
  userType: UserType
  userEvent: ConsumerUserEvent | BusinessUserEvent
  parameters?: UserParameters
}

export type AsyncBatchRecord = (
  | AsyncRuleRecordTransactionBatch
  | AsyncRuleRecordTransactionEventBatch
  | AsyncRuleRecordUserBatch
  | AsyncRuleRecordUserEventBatch
) & {
  batchId: string
}

export type AsyncRuleRecord = (
  | AsyncRuleRecordTransaction
  | AsyncRuleRecordTransactionEvent
  | AsyncRuleRecordUser
  | AsyncRuleRecordUserEvent
  | AsyncBatchRecord
) & {
  tenantId: string
}
