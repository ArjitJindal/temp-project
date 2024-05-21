import { compact, intersection, uniq } from 'lodash'
import { uniqObjects } from './object'
import { CaseAggregates } from '@/@types/openapi-internal/CaseAggregates'
import { InternalTransaction } from '@/@types/openapi-internal/InternalTransaction'
import { Status } from '@/@types/openapi-public-management/Status'
import { CaseStatus } from '@/@types/openapi-internal/CaseStatus'
import { AlertStatus } from '@/@types/openapi-internal/AlertStatus'
import { CASE_STATUSS } from '@/@types/openapi-internal-custom/CaseStatus'

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

export const getStatuses = (
  status?: (Status | null)[] | null
): (CaseStatus | AlertStatus)[] => {
  let selectedStatus: (CaseStatus | AlertStatus)[] | undefined

  if (status?.includes('IN_REVIEW')) {
    selectedStatus = [
      ...([
        'IN_REVIEW_OPEN',
        'IN_REVIEW_ESCALATED',
        'IN_REVIEW_CLOSED',
        'IN_REVIEW_REOPENED',
      ] as const),
    ]
  }

  if (status?.includes('IN_PROGRESS')) {
    selectedStatus = [
      ...(selectedStatus ?? []),
      ...['OPEN_IN_PROGRESS', 'ESCALATED_IN_PROGRESS'],
    ] as const
  }

  if (status?.includes('ON_HOLD')) {
    selectedStatus = [
      ...(selectedStatus ?? []),
      ...(['OPEN_ON_HOLD', 'ESCALATED_ON_HOLD'] as const),
    ]
  }

  selectedStatus = [
    ...(selectedStatus ?? []),
    ...(intersection(status, CASE_STATUSS) as (CaseStatus | AlertStatus)[]),
  ] // Get the status which are as we store

  return selectedStatus
}
