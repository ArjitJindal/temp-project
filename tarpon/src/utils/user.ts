import {
  DefaultApiPostBatchBusinessUserEventsRequest,
  DefaultApiPostBatchBusinessUsersRequest,
  DefaultApiPostBatchConsumerUserEventsRequest,
  DefaultApiPostBatchConsumerUsersRequest,
} from '@/@types/openapi-public/RequestParameters'

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
