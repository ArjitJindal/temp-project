import { CaseAggregates } from '@/@types/openapi-internal/CaseAggregates'

export const DEFAULT_CASE_AGGREGATES: CaseAggregates = {
  destinationPaymentMethods: [],
  originPaymentMethods: [],
  tags: [],
}

export const MAX_TRANSACTION_IN_A_CASE = 50000

export const MAX_ALERTS_IN_A_CASE = 1000
export const API_USER = 'API'
