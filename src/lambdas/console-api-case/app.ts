import {
  APIGatewayEventLambdaAuthorizerContext,
  APIGatewayProxyWithLambdaAuthorizerEvent,
} from 'aws-lambda'
import { NotFound } from 'http-errors'
import { DashboardStatsRepository } from '../console-api-dashboard/repositories/dashboard-stats-repository'
import { CaseService } from './services/case-service'
import { CaseAuditLogService } from './services/case-audit-log-service'
import { lambdaApi } from '@/core/middlewares/lambda-api-middlewares'
import { DefaultApiGetCaseListRequest } from '@/@types/openapi-internal/RequestParameters'

import { getS3Client } from '@/utils/s3'
import { Comment } from '@/@types/openapi-internal/Comment'
import { getMongoDbClient } from '@/utils/mongoDBUtils'
import { JWTAuthorizerResult } from '@/@types/jwt'
import { CaseRepository } from '@/services/rules-engine/repositories/case-repository'
import { CasesUpdateRequest } from '@/@types/openapi-internal/CasesUpdateRequest'
import { Case } from '@/@types/openapi-internal/Case'

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
    const dashboardStatsRepository = new DashboardStatsRepository(tenantId, {
      mongoDb: client,
    })
    const caseService = new CaseService(
      caseRepository,
      dashboardStatsRepository,
      s3,
      TMP_BUCKET,
      DOCUMENT_BUCKET
    )
    const caseAuditLogService = new CaseAuditLogService(caseService, tenantId)
    if (event.httpMethod === 'GET' && event.resource === '/cases') {
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
        filterTransactionId,
        filterTransactionTagKey,
        filterTransactionTagValue,
        includeTransactions,
        includeTransactionUsers,
        includeTransactionEvents,
        beforeTransactionTimestamp,
        afterTransactionTimestamp,
        filterTransactionAmoutBelow,
        filterTransactionAmoutAbove,
        filterOriginCountry,
        filterDestinationCountry,
        filterBusinessIndustries,
        filterUserKYCStatus,
        filterUserState,
        filterRiskLevel,
      } = event.queryStringParameters as any
      const params: DefaultApiGetCaseListRequest = {
        limit: parseInt(limit),
        skip: parseInt(skip),
        afterTimestamp: parseInt(afterTimestamp) || undefined,
        beforeTimestamp: parseInt(beforeTimestamp),
        filterId,
        filterOutStatus,
        filterOutCaseStatus,
        filterTransactionState: filterTransactionState
          ? filterTransactionState.split(',')
          : undefined,
        filterStatus: filterStatus ? filterStatus.split(',') : undefined,
        filterCaseStatus,
        filterRulesExecuted: filterRulesExecuted
          ? filterRulesExecuted.split(',')
          : undefined, // todo: need a proper parser for url
        filterRulesHit: filterRulesHit ? filterRulesHit.split(',') : undefined, // todo: need a proper parser for url
        filterUserId,
        filterOriginUserId,
        filterDestinationUserId,
        filterTransactionId,
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
        filterTransactionTagKey,
        filterTransactionTagValue,
        includeTransactions: includeTransactions === 'true',
        includeTransactionUsers: includeTransactionUsers === 'true',
        includeTransactionEvents: includeTransactionEvents === 'true',
        beforeTransactionTimestamp: beforeTransactionTimestamp
          ? parseInt(beforeTransactionTimestamp)
          : undefined,
        afterTransactionTimestamp: afterTransactionTimestamp
          ? parseInt(afterTransactionTimestamp)
          : undefined,
        filterTransactionAmoutBelow: filterTransactionAmoutBelow
          ? parseInt(filterTransactionAmoutBelow)
          : undefined,
        filterTransactionAmoutAbove: filterTransactionAmoutAbove
          ? parseInt(filterTransactionAmoutAbove)
          : undefined,
        filterOriginCountry,
        filterDestinationCountry,
        filterBusinessIndustries: filterBusinessIndustries
          ? filterBusinessIndustries.split(',')
          : undefined,
        filterUserKYCStatus: filterUserKYCStatus
          ? filterUserKYCStatus.split(',')
          : undefined,
        filterUserState: filterUserState
          ? filterUserState.split(',')
          : undefined,
        filterRiskLevel: filterRiskLevel
          ? filterRiskLevel.split(',')
          : undefined,
      }
      return caseService.getCases(params)
    } else if (
      event.httpMethod === 'POST' &&
      event.resource === '/cases' &&
      event.body
    ) {
      const updateRequest = JSON.parse(event.body) as CasesUpdateRequest
      const caseIds = updateRequest?.caseIds || []
      const { updates } = updateRequest
      const updateResult = await caseService.updateCases(
        userId,
        caseIds,
        updates
      )
      await caseAuditLogService.handleAuditLogForCaseUpdate(caseIds, updates)
      return updateResult
    } else if (
      event.httpMethod === 'GET' &&
      event.resource === '/cases/{caseId}' &&
      event.pathParameters?.caseId
    ) {
      const caseId = event.pathParameters?.caseId as string
      const caseItem: Case | null = await caseService.getCase(caseId, {
        includeTransactionEvents: true,
        includeTransactionUsers: true,
      })
      if (caseItem == null) {
        throw new NotFound(`Case not found: ${caseId}`)
      }
      return caseItem
    } else if (
      event.httpMethod === 'POST' &&
      event.resource === '/cases/{caseId}/comments' &&
      event.pathParameters?.caseId &&
      event.body
    ) {
      const comment = JSON.parse(event.body) as Comment
      const saveCommentResult = await caseService.saveCaseComment(
        event.pathParameters.caseId,
        {
          ...comment,
          userId,
        }
      )
      await caseAuditLogService.handleAuditLogForComments(
        event.pathParameters.caseId,
        comment
      )
      return saveCommentResult
    } else if (
      event.httpMethod === 'GET' &&
      event.resource === '/cases/{caseId}/transactions' &&
      event.pathParameters?.caseId
    ) {
      const { limit, skip, includeUsers } = event.queryStringParameters as any
      return await caseService.getCaseTransactions(
        event.pathParameters.caseId,
        {
          limit: parseInt(limit) || 20,
          skip: parseInt(skip) || 0,
          includeUsers: includeUsers === 'true',
        }
      )
    } else if (
      event.httpMethod === 'DELETE' &&
      event.resource === '/cases/{caseId}/comments/{commentId}' &&
      event.pathParameters?.caseId &&
      event.pathParameters?.commentId
    ) {
      return caseService.deleteCaseComment(
        event.pathParameters.caseId,
        event.pathParameters.commentId
      )
    }
    throw new NotFound('Unhandled request')
  }
)
