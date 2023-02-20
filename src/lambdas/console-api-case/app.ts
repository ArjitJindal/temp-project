import {
  APIGatewayEventLambdaAuthorizerContext,
  APIGatewayProxyWithLambdaAuthorizerEvent,
} from 'aws-lambda'
import { NotFound } from 'http-errors'
import { DashboardStatsRepository } from '../console-api-dashboard/repositories/dashboard-stats-repository'
import { CaseService } from './services/case-service'
import { CaseAuditLogService } from './services/case-audit-log-service'
import { lambdaApi } from '@/core/middlewares/lambda-api-middlewares'
import { addNewSubsegment } from '@/core/xray'
import { DefaultApiGetCaseListRequest } from '@/@types/openapi-internal/RequestParameters'
import { getS3ClientByEvent } from '@/utils/s3'
import { Comment } from '@/@types/openapi-internal/Comment'
import { getMongoDbClient } from '@/utils/mongoDBUtils'
import { JWTAuthorizerResult } from '@/@types/jwt'
import { CaseRepository } from '@/services/rules-engine/repositories/case-repository'
import { CasesUpdateRequest } from '@/@types/openapi-internal/CasesUpdateRequest'
import { Case } from '@/@types/openapi-internal/Case'
import { getDynamoDbClientByEvent } from '@/utils/dynamodb'

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
    const s3 = getS3ClientByEvent(event)
    const client = await getMongoDbClient()
    const dynamoDb = await getDynamoDbClientByEvent(event)
    const caseRepository = new CaseRepository(tenantId, {
      mongoDb: client,
      dynamoDb,
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
        page,
        pageSize,
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
        filterAssignmentsIds,
      } = event.queryStringParameters as any
      const params: DefaultApiGetCaseListRequest = {
        page,
        pageSize,
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
        filterAssignmentsIds: filterAssignmentsIds
          ? filterAssignmentsIds.split(',')
          : undefined,
      }
      const caseGetSegment = await addNewSubsegment('Case Service', 'Get Cases')
      caseGetSegment?.addAnnotation('tenantId', tenantId)
      caseGetSegment?.addAnnotation('getParams', JSON.stringify(params))
      const cases = caseService.getCases(params)
      caseGetSegment?.close()

      return cases
    } else if (
      event.httpMethod === 'POST' &&
      event.resource === '/cases' &&
      event.body
    ) {
      const updateRequest = JSON.parse(event.body) as CasesUpdateRequest
      const caseIds = updateRequest?.caseIds || []
      const { updates } = updateRequest
      const caseUpdateSegment = await addNewSubsegment(
        'Case Service',
        'Case Update'
      )
      caseUpdateSegment?.addAnnotation('tenantId', tenantId)
      caseUpdateSegment?.addAnnotation('caseIds', caseIds.toString())

      const updateResult = await caseService.updateCases(
        userId,
        caseIds,
        updates
      )
      caseUpdateSegment?.close()

      await caseAuditLogService.handleAuditLogForCaseUpdate(caseIds, updates)
      return updateResult
    } else if (
      event.httpMethod === 'GET' &&
      event.resource === '/cases/{caseId}' &&
      event.pathParameters?.caseId
    ) {
      const caseId = event.pathParameters?.caseId as string
      const caseGetSegment = await addNewSubsegment(
        'Case Service',
        'Get Case Details'
      )
      caseGetSegment?.addAnnotation('tenantId', tenantId)
      caseGetSegment?.addAnnotation('caseId', caseId)
      const caseItem: Case | null = await caseService.getCase(caseId, {
        includeTransactionEvents: true,
        includeTransactionUsers: true,
      })
      caseGetSegment?.close()
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
      const { page, pageSize, includeUsers } =
        event.queryStringParameters as any
      const caseGetTransactionsSegment = await addNewSubsegment(
        'Case Service',
        'Get Case Transactions'
      )
      caseGetTransactionsSegment?.addAnnotation('tenantId', tenantId)
      caseGetTransactionsSegment?.addAnnotation(
        'caseId',
        event.pathParameters.caseId
      )
      const caseTransactions = await caseService.getCaseTransactions(
        event.pathParameters.caseId,
        {
          page,
          pageSize,
          includeUsers: includeUsers === 'true',
        }
      )
      caseGetTransactionsSegment?.close()
      return caseTransactions
    } else if (
      event.httpMethod === 'GET' &&
      event.resource === '/cases/{caseId}/rules' &&
      event.pathParameters?.caseId
    ) {
      return await caseService.getCaseRules(event.pathParameters.caseId)
    } else if (
      event.httpMethod === 'GET' &&
      event.resource ===
        '/cases/{caseId}/rule/{rulesInstanceId}/transactions' &&
      event.pathParameters?.caseId &&
      event.pathParameters?.rulesInstanceId
    ) {
      const { page, pageSize, sortField, sortOrder } =
        event.queryStringParameters as any
      const caseGetRuleTransactionsSegment = await addNewSubsegment(
        'Case Service',
        'Get Case Rule Transactions'
      )
      caseGetRuleTransactionsSegment?.addAnnotation('tenantId', tenantId)
      caseGetRuleTransactionsSegment?.addAnnotation(
        'caseId',
        event.pathParameters.caseId
      )
      const caseRuleTransactions = await caseService.getCaseRuleTransactions(
        event.pathParameters.caseId,
        event.pathParameters.rulesInstanceId,
        { page, pageSize },
        { sortField, sortOrder }
      )
      caseGetRuleTransactionsSegment?.close()
      return caseRuleTransactions
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
