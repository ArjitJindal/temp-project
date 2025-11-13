import compact from 'lodash/compact'
import isEqual from 'lodash/isEqual'
import { formatConsumerName } from './helpers'
import { BusinessWithRulesResult } from '@/@types/openapi-internal/BusinessWithRulesResult'
import {
  DefaultApiPostBatchBusinessUserEventsRequest,
  DefaultApiPostBatchBusinessUsersRequest,
  DefaultApiPostBatchConsumerUserEventsRequest,
  DefaultApiPostBatchConsumerUsersRequest,
} from '@/@types/openapi-public/RequestParameters'
import { UserWithRulesResult } from '@/@types/openapi-public/UserWithRulesResult'

export const FLAGRIGHT_SYSTEM_USER = 'Flagright System'
export const API_USER = 'API'

export const batchCreateUserOptions = (
  request:
    | DefaultApiPostBatchConsumerUsersRequest
    | DefaultApiPostBatchBusinessUsersRequest
    | DefaultApiPostBatchConsumerUserEventsRequest
    | DefaultApiPostBatchBusinessUserEventsRequest
) => ({
  lockCraRiskLevel: request.lockCraRiskLevel
    ? request.lockCraRiskLevel === 'true'
    : undefined,
  lockKycRiskLevel: request.lockKycRiskLevel
    ? request.lockKycRiskLevel === 'true'
    : undefined,
})

export const getBusinessUserNames = (user: BusinessWithRulesResult) => {
  return {
    legalEntityName: user.legalEntity.companyGeneralDetails.legalName,
    shareHoldersNames: compact(
      user.shareHolders?.map((shareHolder) =>
        formatConsumerName(shareHolder.generalDetails?.name)
      )
    ),
    directorsNames: compact(
      user.directors?.map((director) =>
        formatConsumerName(director.generalDetails?.name)
      )
    ),
  }
}

export const hasAnyNameChanged = (
  newUser: UserWithRulesResult | BusinessWithRulesResult,
  oldUser: UserWithRulesResult | BusinessWithRulesResult | undefined,
  type: 'CONSUMER' | 'BUSINESS'
) => {
  if (!oldUser) {
    return true
  }
  if (type === 'CONSUMER') {
    return (
      formatConsumerName((newUser as UserWithRulesResult).userDetails?.name) !==
      formatConsumerName((oldUser as UserWithRulesResult).userDetails?.name)
    )
  }
  if (type === 'BUSINESS') {
    const currentNames = getBusinessUserNames(
      newUser as BusinessWithRulesResult
    )
    const oldNames = getBusinessUserNames(oldUser as BusinessWithRulesResult)
    return (
      currentNames.legalEntityName !== oldNames.legalEntityName ||
      !isEqual(currentNames.shareHoldersNames, oldNames.shareHoldersNames) ||
      !isEqual(currentNames.directorsNames, oldNames.directorsNames)
    )
  }
  return false
}
