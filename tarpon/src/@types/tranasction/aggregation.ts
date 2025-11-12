import { LogicAggregationVariable } from '../openapi-internal/LogicAggregationVariable'
import { RiskScoreComponent } from '../openapi-internal/RiskScoreComponent'
import { TransactionRuleStage } from '../openapi-internal/TransactionRuleStage'
import { UserRuleStage } from '../openapi-internal/UserRuleStage'
import { Transaction } from '../openapi-public/Transaction'
import { TransactionRiskScoringResult } from '../openapi-public/TransactionRiskScoringResult'
import { TransactionMonitoringResult } from '../openapi-public/TransactionMonitoringResult'
import { Address } from '../openapi-public/Address'
import { ConsumerName } from '../openapi-internal/ConsumerName'
import { PaymentDetails } from './payment-type'
import { LegacyFilters } from '@/services/rules-engine/filters'

export type RiskScoreDetails = TransactionRiskScoringResult & {
  components?: RiskScoreComponent[]
}
export type TimestampSlice = {
  startTimestamp: number
  endTimestamp: number
  sliceNumber?: number
}

export type TransactionAggregationTask = {
  transactionId: string
  ruleInstanceId: string
  direction: 'origin' | 'destination'
  tenantId: string
  isTransactionHistoricalFiltered: boolean
}
export type V8TransactionAggregationTask = {
  type: 'TRANSACTION_AGGREGATION'
  tenantId: string
  aggregationVariable?: LogicAggregationVariable
  transaction: Transaction
  direction?: 'origin' | 'destination'
  filters?: LegacyFilters
  transactionRiskScore?: number
}

export type EntityData =
  | { type: 'ADDRESS'; address: Address }
  | { type: 'EMAIL'; email: string }
  | { type: 'NAME'; name: ConsumerName | string }

export type V8LogicAggregationRebuildTask = {
  type: 'PRE_AGGREGATION'
  tenantId: string
  entity?:
    | { type: 'RULE'; ruleInstanceId: string }
    | { type: 'RISK_FACTOR'; riskFactorId: string }
  jobId: string
  aggregationVariable: LogicAggregationVariable
  currentTimestamp: number
  timeWindow?: TimestampSlice
  totalSliceCount?: number
  userId?: string
  paymentDetails?: PaymentDetails
  entityData?: EntityData
  isConsumer?: boolean
}

export type TransactionAggregationTaskEntry = {
  userKeyId: string
  payload:
    | TransactionAggregationTask
    | V8TransactionAggregationTask
    | V8LogicAggregationRebuildTask
}
export type ValidationOptions = {
  validateTransactionId?: boolean
  validateOriginUserId?: boolean
  validateDestinationUserId?: boolean
}
export type RuleStage = TransactionRuleStage | UserRuleStage
export type DuplicateTransactionReturnType = TransactionMonitoringResult & {
  message: string
}
