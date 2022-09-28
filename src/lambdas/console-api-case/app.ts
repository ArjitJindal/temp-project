import {
  APIGatewayEventLambdaAuthorizerContext,
  APIGatewayProxyWithLambdaAuthorizerEvent,
} from 'aws-lambda'
import { CaseService } from './services/case-service'
import { lambdaApi } from '@/core/middlewares/lambda-api-middlewares'
import { DefaultApiGetCaseListRequest } from '@/@types/openapi-internal/RequestParameters'

import { getS3Client } from '@/utils/s3'
import { Comment } from '@/@types/openapi-internal/Comment'
import { getMongoDbClient } from '@/utils/mongoDBUtils'
import { JWTAuthorizerResult } from '@/@types/jwt'
import { CaseRepository } from '@/services/rules-engine/repositories/case-repository'
import { CasesUpdateRequest } from '@/@types/openapi-internal/CasesUpdateRequest'

export type CaseConfig = {
  TMP_BUCKET: string
  DOCUMENT_BUCKET: string
}

export const casesHandler = lambdaApi()(
  async (
    event: APIGatewayProxyWithLambdaAuthorizerEvent<
      APIGatewayEventLambdaAuthorizerContext<JWTAuthorizerResult>
    >
  ) => {
    const { principalId: tenantId, userId } = event.requestContext.authorizer
    const { DOCUMENT_BUCKET, TMP_BUCKET } = process.env as CaseConfig
    const s3 = getS3Client(event)
    const client = await getMongoDbClient()
    const caseRepository = new CaseRepository(tenantId, {
      mongoDb: client,
    })
    const caseService = new CaseService(
      caseRepository,
      s3,
      TMP_BUCKET,
      DOCUMENT_BUCKET
    )
    if (event.httpMethod === 'GET' && event.path.endsWith('/cases')) {
      const {
        limit,
        skip,
        afterTimestamp,
        beforeTimestamp,
        filterId,
        filterOutStatus,
        filterOutCaseStatus,
        filterTransactionState,
        filterRulesHit,
        filterRulesExecuted,
        filterOriginCurrencies,
        filterDestinationCurrencies,
        filterUserId,
        filterOriginUserId,
        filterDestinationUserId,
        transactionType,
        sortField,
        sortOrder,
        filterStatus,
        filterCaseStatus,
        filterOriginPaymentMethod,
        filterDestinationPaymentMethod,
        filterCaseType,
        filterPriority,
      } = event.queryStringParameters as any
      const params: DefaultApiGetCaseListRequest = {
        limit: parseInt(limit),
        skip: parseInt(skip),
        afterTimestamp: parseInt(afterTimestamp) || undefined,
        beforeTimestamp: parseInt(beforeTimestamp),
        filterId,
        filterOutStatus,
        filterOutCaseStatus,
        filterTransactionState,
        filterStatus,
        filterCaseStatus,
        filterRulesExecuted: filterRulesExecuted
          ? filterRulesExecuted.split(',')
          : undefined, // todo: need a proper parser for url
        filterRulesHit: filterRulesHit ? filterRulesHit.split(',') : undefined, // todo: need a proper parser for url
        filterUserId,
        filterOriginUserId,
        filterDestinationUserId,
        transactionType,
        sortField: sortField,
        sortOrder: sortOrder,
        filterOriginCurrencies: filterOriginCurrencies
          ? filterOriginCurrencies.split(',')
          : undefined,
        filterDestinationCurrencies: filterDestinationCurrencies
          ? filterDestinationCurrencies.split(',')
          : undefined,
        filterOriginPaymentMethod: filterOriginPaymentMethod,
        filterDestinationPaymentMethod: filterDestinationPaymentMethod,
        filterCaseType,
        filterPriority,
      }
      return caseService.getCases(params)
    } else if (
      event.httpMethod === 'POST' &&
      event.path.endsWith('/cases') &&
      event.body
    ) {
      const updateRequest = JSON.parse(event.body) as CasesUpdateRequest
      const caseIds = updateRequest?.caseIds || []
      return caseService.updateCases(userId, caseIds, updateRequest.updates)
    } else if (
      event.httpMethod === 'POST' &&
      event.resource === '/cases/{caseId}/comments' &&
      event.pathParameters?.caseId &&
      event.body
    ) {
      const comment = JSON.parse(event.body) as Comment
      return caseService.saveCaseComment(event.pathParameters.caseId, {
        ...comment,
        userId,
      })
    } else if (
      event.httpMethod === 'DELETE' &&
      event.pathParameters?.caseId &&
      event.pathParameters?.commentId
    ) {
      return caseService.deleteCaseComment(
        event.pathParameters.caseId,
        event.pathParameters.commentId
      )
    }

    throw new Error('Unhandled request')
  }
)
