import compact from 'lodash/compact'
import intersection from 'lodash/intersection'
import uniq from 'lodash/uniq'
import { areArraysOfObjectsEqual } from '@flagright/lib/utils'
import { uniqObjects } from './object'
import { CaseAggregates } from '@/@types/openapi-internal/CaseAggregates'
import { InternalTransaction } from '@/@types/openapi-internal/InternalTransaction'
import { Status } from '@/@types/openapi-public-management/Status'
import { CaseStatus } from '@/@types/openapi-internal/CaseStatus'
import { AlertStatus } from '@/@types/openapi-internal/AlertStatus'
import { CASE_STATUSS } from '@/@types/openapi-internal-custom/CaseStatus'
import { CaseStatusUpdate } from '@/@types/openapi-internal/CaseStatusUpdate'
import { UserUpdateRequest } from '@/@types/openapi-internal/UserUpdateRequest'
import { AlertStatusUpdateRequest } from '@/@types/openapi-internal/AlertStatusUpdateRequest'
import { InternalUser } from '@/@types/openapi-internal/InternalUser'
import { CaseCaseUsers } from '@/@types/openapi-internal/CaseCaseUsers'

export const generateCaseAggreates = (
  transactions: InternalTransaction[],
  existingCaseAggregates: CaseAggregates,
  caseUsers?: CaseCaseUsers
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

  // Collect transaction tags
  const transactionTags = transactions.flatMap(
    (transaction) => transaction?.tags ?? []
  )

  // Collect user tags from case users
  const userTags: Array<{ key: string; value: string }> = []
  if (
    caseUsers?.origin &&
    'tags' in caseUsers.origin &&
    caseUsers.origin.tags
  ) {
    userTags.push(...caseUsers.origin.tags)
  }
  if (
    caseUsers?.destination &&
    'tags' in caseUsers.destination &&
    caseUsers.destination.tags
  ) {
    userTags.push(...caseUsers.destination.tags)
  }

  // Combine transaction tags, user tags, and existing tags
  const tags = uniqObjects(
    transactionTags.concat(userTags).concat(existingCaseAggregates?.tags ?? [])
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

export const getUserUpdateRequest = (
  updates: CaseStatusUpdate | AlertStatusUpdateRequest,
  userInDb: InternalUser | undefined
): UserUpdateRequest => {
  const screeningDetails = updates.screeningDetails
  const eoddDate = updates.eoddDate

  // from frontend, we send the current image of user tags and pep status
  // updating user tags and pep status only when they differ from image stored in db
  // user changes are only updated when closing/escalating a single case, thus can select the first entity

  const userTagsInDb = userInDb?.tags ?? undefined
  const tags = updates.tags ?? undefined

  let isUserTagsChanged = false
  if (tags) {
    isUserTagsChanged = !areArraysOfObjectsEqual(userTagsInDb, tags)
  }

  const userPepStatusInDb = userInDb?.pepStatus ?? undefined
  const pepStatus = screeningDetails?.pepStatus ?? undefined
  let isPepStatusChanged = false
  if (pepStatus) {
    isPepStatusChanged = !areArraysOfObjectsEqual(userPepStatusInDb, pepStatus)
  }
  const updateObject: UserUpdateRequest = {}

  if (updates.kycStatusDetails?.status) {
    updateObject.kycStatusDetails = { ...updates.kycStatusDetails }
  }

  if (updates.userStateDetails?.state) {
    updateObject.userStateDetails = { ...updates.userStateDetails }
  }

  if (eoddDate) {
    updateObject.eoddDate = eoddDate
  }

  if (isUserTagsChanged && tags) {
    updateObject.tags = tags
  }

  if (isPepStatusChanged && screeningDetails?.pepStatus) {
    updateObject.pepStatus = screeningDetails.pepStatus
  }

  if (screeningDetails?.sanctionsStatus !== undefined) {
    updateObject.sanctionsStatus = screeningDetails.sanctionsStatus
  }

  if (screeningDetails?.adverseMediaStatus !== undefined) {
    updateObject.adverseMediaStatus = screeningDetails.adverseMediaStatus
  }

  return updateObject
}
