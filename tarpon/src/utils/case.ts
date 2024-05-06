import { compact, uniq } from 'lodash'
import { uniqObjects } from './object'
import { CaseAggregates } from '@/@types/openapi-internal/CaseAggregates'
import { InternalTransaction } from '@/@types/openapi-internal/InternalTransaction'

export const DEFAULT_CASE_AGGREGATES: CaseAggregates = {
  destinationPaymentMethods: [],
  originPaymentMethods: [],
  tags: [],
}

export const generateCaseAggreates = (
  transactions: InternalTransaction[],
  existingCaseAggregates: CaseAggregates
): CaseAggregates => {
  const originPaymentMethods = uniq(
    compact(
      transactions.map(
        (transaction) => transaction?.originPaymentDetails?.method
      )
    ).concat(existingCaseAggregates?.originPaymentMethods ?? [])
  )

  const destinationPaymentMethods = uniq(
    compact(
      transactions.map(
        (transaction) => transaction?.destinationPaymentDetails?.method
      )
    ).concat(existingCaseAggregates?.destinationPaymentMethods ?? [])
  )

  const tags = uniqObjects(
    transactions
      .flatMap((transaction) => transaction?.tags ?? [])
      .concat(existingCaseAggregates?.tags ?? [])
  )

  return {
    originPaymentMethods,
    destinationPaymentMethods,
    tags,
  }
}
