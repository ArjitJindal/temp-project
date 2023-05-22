import {
  APIGatewayEventLambdaAuthorizerContext,
  APIGatewayProxyWithLambdaAuthorizerEvent,
} from 'aws-lambda'
import { NotFound, BadRequest } from 'http-errors'
import { CaseService } from './services/case-service'
import { CasesAlertsAuditLogService } from './services/case-alerts-audit-log-service'
import { AccountsService } from '@/services/accounts'
import { lambdaApi } from '@/core/middlewares/lambda-api-middlewares'
import { addNewSubsegment } from '@/core/xray'
import {
  DefaultApiGetAlertListRequest,
  DefaultApiGetCaseListRequest,
} from '@/@types/openapi-internal/RequestParameters'
import { getS3ClientByEvent } from '@/utils/s3'
import { Comment } from '@/@types/openapi-internal/Comment'
import { getMongoDbClient } from '@/utils/mongoDBUtils'
import { JWTAuthorizerResult } from '@/@types/jwt'
import { CaseRepository } from '@/services/rules-engine/repositories/case-repository'
import { CasesUpdateRequest } from '@/@types/openapi-internal/CasesUpdateRequest'
import { AlertsToNewCaseRequest } from '@/@types/openapi-internal/AlertsToNewCaseRequest'
import { getDynamoDbClientByEvent } from '@/utils/dynamodb'
import { TransactionState } from '@/@types/openapi-internal/TransactionState'
import { CaseCreationService } from '@/lambdas/console-api-case/services/case-creation-service'
import { UserRepository } from '@/services/users/repositories/user-repository'
import { RuleInstanceRepository } from '@/services/rules-engine/repositories/rule-instance-repository'
import { MongoDbTransactionRepository } from '@/services/rules-engine/repositories/mongodb-transaction-repository'
import { isValidSortOrder } from '@/@types/openapi-internal-custom/SortOrder'
import { Case } from '@/@types/openapi-internal/Case'
import { CaseEscalationRequest } from '@/@types/openapi-internal/CaseEscalationRequest'
import { hasFeature } from '@/core/utils/context'
import { AlertsService } from '@/services/alerts'
import { AlertsRepository } from '@/services/rules-engine/repositories/alerts-repository'
import { parseStrings } from '@/utils/lambda'
import { AlertsStatusUpdateRequest } from '@/@types/openapi-internal/AlertsStatusUpdateRequest'
import { AlertsAssignmentUpdateRequest } from '@/@types/openapi-internal/AlertsAssignmentUpdateRequest'

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
    const {
      principalId: tenantId,
      userId,
      auth0Domain,
    } = event.requestContext.authorizer
    const { DOCUMENT_BUCKET, TMP_BUCKET } = process.env as CaseConfig
    const s3 = getS3ClientByEvent(event)
    const client = await getMongoDbClient()
    const dynamoDb = await getDynamoDbClientByEvent(event)
    const dbs = {
      mongoDb: client,
      dynamoDb,
    }
    const caseRepository = new CaseRepository(tenantId, dbs)
    const alertsRepository = new AlertsRepository(tenantId, {
      mongoDb: client,
      dynamoDb,
    })

    const alertsService = new AlertsService(alertsRepository, s3, {
      documentBucketName: DOCUMENT_BUCKET,
      tmpBucketName: TMP_BUCKET,
    })

    const userService = new UserRepository(tenantId, dbs)
    const ruleInstanceRepository = new RuleInstanceRepository(tenantId, dbs)
    const transactionRepository = new MongoDbTransactionRepository(
      tenantId,
      client
    )

    const caseService = new CaseService(caseRepository, s3, {
      documentBucketName: DOCUMENT_BUCKET,
      tmpBucketName: TMP_BUCKET,
    })

    const caseCreationService = new CaseCreationService(
      caseRepository,
      userService,
      ruleInstanceRepository,
      transactionRepository
    )
    const casesAlertsAuditLogService = new CasesAlertsAuditLogService(
      caseService,
      alertsService,
      tenantId
    )
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
        afterCaseLastUpdatedTimestamp,
        beforeCaseLastUpdatedTimestamp,
      } = event.queryStringParameters as any
      const params: DefaultApiGetCaseListRequest = {
        page,
        pageSize,
        afterTimestamp: parseInt(afterTimestamp) || undefined,
        beforeTimestamp: parseInt(beforeTimestamp),
        afterCaseLastUpdatedTimestamp: parseInt(afterCaseLastUpdatedTimestamp)
          ? parseInt(afterCaseLastUpdatedTimestamp)
          : undefined,
        beforeCaseLastUpdatedTimestamp: parseInt(beforeCaseLastUpdatedTimestamp)
          ? parseInt(beforeCaseLastUpdatedTimestamp)
          : undefined,
        filterId,
        filterOutStatus,
        filterOutCaseStatus: parseStrings(filterOutCaseStatus),
        filterTransactionState: filterTransactionState
          ? filterTransactionState.split(',')
          : undefined,
        filterStatus: filterStatus ? filterStatus.split(',') : undefined,
        filterCaseStatus: parseStrings(filterCaseStatus),
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
        filterOriginPaymentMethod: filterOriginPaymentMethod
          ? filterOriginPaymentMethod.split(',')
          : undefined,
        filterDestinationPaymentMethod: filterDestinationPaymentMethod
          ? filterDestinationPaymentMethod.split(',')
          : undefined,
        filterPriority,
        filterTransactionTagKey,
        filterTransactionTagValue,
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

      await casesAlertsAuditLogService.handleAuditLogForCaseUpdate(
        caseIds,
        updates
      )
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
      const caseItem: Case | null = await caseService.getCase(caseId)
      caseGetSegment?.close()
      if (caseItem == null) {
        throw new NotFound(`Case not found: ${caseId}`)
      }
      return caseResponse(caseItem)
    } else if (
      event.httpMethod === 'POST' &&
      event.resource === '/cases/{caseId}/comments' &&
      event.pathParameters?.caseId &&
      event.body
    ) {
      const comment = JSON.parse(event.body) as Comment

      const saveCommentResult = await caseService.saveCaseComment(
        event.pathParameters.caseId,
        { ...comment, userId }
      )

      await casesAlertsAuditLogService.handleAuditLogForComments(
        event.pathParameters.caseId,
        comment
      )
      return saveCommentResult
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
    } else if (event.httpMethod === 'GET' && event.resource === '/alerts') {
      const {
        page,
        pageSize,
        filterAlertId,
        filterOutCaseStatus,
        filterCaseStatus,
        filterOutAlertStatus,
        filterAlertStatus,
        filterAssignmentsIds,
        filterTransactionState,
        filterBusinessIndustries,
        filterTransactionTagKey,
        filterTransactionTagValue,
        filterOriginPaymentMethod,
        filterDestinationPaymentMethod,
        filterUserId,
        filterCaseId,
        sortField,
        sortOrder,
        beforeAlertLastUpdatedTimestamp,
        afterAlertLastUpdatedTimestamp,
        filterAlertBeforeCreatedTimestamp,
        filterAlertAfterCreatedTimestamp,
        filterCaseBeforeCreatedTimestamp,
        filterCaseAfterCreatedTimestamp,
        filterRulesHit,
      } = event.queryStringParameters as Record<string, string>
      const params: DefaultApiGetAlertListRequest = {
        page: parseInt(page),
        pageSize: parseInt(pageSize),
        filterAlertId: filterAlertId,
        filterOutCaseStatus: parseStrings(filterOutCaseStatus),
        filterCaseStatus: parseStrings(filterCaseStatus),
        filterAlertStatus: parseStrings(filterAlertStatus),
        filterOutAlertStatus: parseStrings(filterOutAlertStatus),
        filterAssignmentsIds: filterAssignmentsIds?.split(','),
        filterBusinessIndustries: filterBusinessIndustries?.split(','),
        filterTransactionState: filterTransactionState?.split(',') as
          | TransactionState[]
          | undefined,
        filterTransactionTagKey,
        filterTransactionTagValue,
        filterUserId,
        filterCaseId,
        filterOriginPaymentMethod: filterOriginPaymentMethod
          ? filterOriginPaymentMethod.split(',')
          : undefined,
        filterDestinationPaymentMethod: filterDestinationPaymentMethod
          ? filterDestinationPaymentMethod.split(',')
          : undefined,
        sortField,
        sortOrder: isValidSortOrder(sortOrder) ? sortOrder : undefined,
        beforeAlertLastUpdatedTimestamp: beforeAlertLastUpdatedTimestamp
          ? parseInt(beforeAlertLastUpdatedTimestamp)
          : undefined,
        afterAlertLastUpdatedTimestamp: afterAlertLastUpdatedTimestamp
          ? parseInt(afterAlertLastUpdatedTimestamp)
          : undefined,
        filterAlertBeforeCreatedTimestamp: filterAlertBeforeCreatedTimestamp
          ? parseInt(filterAlertBeforeCreatedTimestamp)
          : undefined,
        filterAlertAfterCreatedTimestamp: filterAlertAfterCreatedTimestamp
          ? parseInt(filterAlertAfterCreatedTimestamp)
          : undefined,
        filterCaseBeforeCreatedTimestamp: filterCaseBeforeCreatedTimestamp
          ? parseInt(filterCaseBeforeCreatedTimestamp)
          : undefined,
        filterCaseAfterCreatedTimestamp: filterCaseAfterCreatedTimestamp
          ? parseInt(filterCaseAfterCreatedTimestamp)
          : undefined,
        filterRulesHit: filterRulesHit?.split(',') as string[],
      }
      return alertsService.getAlerts(params)
    } else if (
      event.httpMethod === 'PATCH' &&
      event.resource === '/alerts/statusChange' &&
      event.body
    ) {
      const updateRequest = JSON.parse(event.body) as AlertsStatusUpdateRequest
      const alertIds = updateRequest?.alertIds

      if (!alertIds?.length) {
        throw new BadRequest('Missing alertIds in request body or empty array')
      }

      const { updates } = updateRequest
      const alertUpdateSegment = await addNewSubsegment(
        'Case Service',
        'Alert Update'
      )
      try {
        alertUpdateSegment?.addAnnotation('tenantId', tenantId)
        alertUpdateSegment?.addAnnotation('alertIds', alertIds.toString())
        const updateResult = await alertsService.updateAlertsStatus(
          alertIds,
          updates
        )
        await casesAlertsAuditLogService.handleAuditLogForAlertsUpdate(
          alertIds,
          updates
        )
        return updateResult
      } finally {
        alertUpdateSegment?.close()
      }
    } else if (
      event.httpMethod === 'PATCH' &&
      event.resource === '/alerts/assignee' &&
      event.body
    ) {
      const updateRequest = JSON.parse(
        event.body
      ) as AlertsAssignmentUpdateRequest
      const alertIds = updateRequest?.alertIds

      if (!alertIds?.length) {
        throw new BadRequest('Missing alertIds or empty alertIds array')
      }

      const { assignment } = updateRequest

      const alertUpdateSegment = await addNewSubsegment(
        'Case Service',
        'Alert Assignee Update'
      )

      const timestamp = Date.now()

      try {
        alertUpdateSegment?.addAnnotation('tenantId', tenantId)
        alertUpdateSegment?.addAnnotation('alertIds', alertIds.toString())
        await alertsService.updateAssigneeToAlerts(alertIds, {
          ...assignment,
          timestamp,
        })
        await casesAlertsAuditLogService.handleAuditLogForAlertsUpdate(
          alertIds,
          {
            assignments: [
              {
                ...assignment,
                timestamp,
              },
            ],
          }
        )
        return 'OK'
      } finally {
        alertUpdateSegment?.close()
      }
    } else if (
      event.httpMethod === 'GET' &&
      event.resource === '/alerts/{alertId}'
    ) {
      const alertId = event.pathParameters?.alertId as string
      const alert = await alertsRepository.getAlertById(alertId)
      if (alert == null) {
        throw new NotFound(`Alert "${alertId}" not found`)
      }
      await casesAlertsAuditLogService.createAlertAuditLog({
        alertId,
        logAction: 'VIEW',
        oldImage: {},
        newImage: {},
        alertDetails: alert,
      })
      return alert
    } else if (
      event.httpMethod === 'POST' &&
      event.resource === '/alerts/new-case' &&
      event.body
    ) {
      const requestPayload = JSON.parse(event.body) as AlertsToNewCaseRequest
      const sourceCaseId = requestPayload?.sourceCaseId
      const alertIds = requestPayload?.alertIds || []
      const segment = await addNewSubsegment(
        'Case Service',
        'Create new case from alerts'
      )
      try {
        const sourceCase = await caseService.getCase(sourceCaseId)
        if (sourceCase == null) {
          throw new NotFound(
            `Unable to find source case by id "${sourceCaseId}"`
          )
        }
        const newCase = await caseCreationService.createNewCaseFromAlerts(
          sourceCase,
          alertIds
        )
        await casesAlertsAuditLogService.handleAuditLogForNewCase(newCase)
        await casesAlertsAuditLogService.handleAuditLogForAlerts(
          sourceCaseId,
          sourceCase.alerts,
          (
            await caseService.getCase(sourceCaseId)
          )?.alerts
        )
        return caseResponse(newCase)
      } finally {
        segment?.close()
      }
    } else if (
      event.httpMethod === 'GET' &&
      event.resource === '/alerts/{alertId}/transactions'
    ) {
      const alertId = event.pathParameters?.alertId as string
      const {
        page,
        pageSize,
        showExecutedTransactions,
        userId,
        originUserId,
        destinationUserId,
      } = event.queryStringParameters as any

      return await alertsService.getAlertTransactions(alertId, {
        alertId,
        page,
        pageSize,
        showExecutedTransactions: showExecutedTransactions == 'true',
        userId,
        originUserId,
        destinationUserId,
      })
    } else if (
      event.httpMethod === 'POST' &&
      event.resource === '/alerts/{alertId}/comments' &&
      event.body
    ) {
      const alertId = event.pathParameters?.alertId as string
      const comment = JSON.parse(event.body) as Comment
      const saveCommentResult = await alertsService.saveAlertComment(alertId, {
        ...comment,
        userId,
      })
      await casesAlertsAuditLogService.createAlertAuditLog({
        alertId,
        logAction: 'CREATE',
        oldImage: {},
        newImage: comment,
        subtype: 'COMMENT',
      })
      return saveCommentResult
    } else if (
      event.httpMethod === 'DELETE' &&
      event.resource === '/alerts/{alertId}/comments/{commentId}'
    ) {
      const alertId = event.pathParameters?.alertId as string
      const commentId = event.pathParameters?.commentId as string
      const alert = await alertsRepository.getAlertById(alertId)
      const comment =
        alert?.comments?.find(({ id }) => id === commentId) ?? null
      if (comment == null) {
        throw new NotFound(`"${commentId}" comment not found`)
      }

      await alertsService.deleteAlertComment(alertId, commentId)
      await casesAlertsAuditLogService.createAlertAuditLog({
        alertId,
        logAction: 'DELETE',
        oldImage: comment,
        newImage: {},
        subtype: 'COMMENT',
      })
      return 'OK'
    } else if (
      event.httpMethod === 'POST' &&
      event.resource === '/cases/{caseId}/escalate' &&
      event.pathParameters?.caseId &&
      event.body
    ) {
      if (!hasFeature('ESCALATION')) {
        throw new BadRequest('Feature not enabled')
      }
      const caseId = event.pathParameters.caseId as string
      const escalationRequest = JSON.parse(event.body) as CaseEscalationRequest
      const accountsService = new AccountsService(
        { auth0Domain },
        { mongoDb: client }
      )
      if (
        !escalationRequest.alertEscalations ||
        escalationRequest.alertEscalations.length === 0
      ) {
        const allAccounts = (
          await accountsService.getTenantAccounts(
            await accountsService.getAccountTenant(userId)
          )
        ).filter((account) => !account.blocked)
        if (!escalationRequest.caseUpdateRequest) {
          throw new BadRequest('Case update request not provided')
        }
        await caseService.escalateCase(
          caseId,
          escalationRequest.caseUpdateRequest,
          allAccounts
        )
        return {
          childCaseId: undefined,
        }
      } else if (escalationRequest.alertEscalations) {
        const allAccounts = (
          await accountsService.getTenantAccounts(
            await accountsService.getAccountTenant(userId)
          )
        ).filter((account) => !account.blocked)
        const childCaseId = await alertsService.escalateAlerts(
          caseId,
          escalationRequest,
          allAccounts
        )
        return {
          childCaseId,
        }
      }
    }
    throw new NotFound('Unhandled request')
  }
)

function caseResponse(c: Case): Case {
  c.caseTransactions = undefined
  c.caseTransactionsIds = undefined
  c.alerts?.map((a) => {
    a.transactionIds = []
    return a
  })
  return c
}
