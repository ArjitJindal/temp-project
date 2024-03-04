import {
  APIGatewayEventLambdaAuthorizerContext,
  APIGatewayProxyWithLambdaAuthorizerEvent,
} from 'aws-lambda'
import { NotFound, BadRequest, Forbidden } from 'http-errors'
import { CaseService } from './services/case-service'
import { CasesAlertsAuditLogService } from './services/case-alerts-audit-log-service'
import { lambdaApi } from '@/core/middlewares/lambda-api-middlewares'
import { getS3ClientByEvent } from '@/utils/s3'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import { JWTAuthorizerResult } from '@/@types/jwt'
import { CaseRepository } from '@/services/rules-engine/repositories/case-repository'
import { getDynamoDbClientByEvent } from '@/utils/dynamodb'
import { CaseCreationService } from '@/lambdas/console-api-case/services/case-creation-service'
import { UserRepository } from '@/services/users/repositories/user-repository'
import { RuleInstanceRepository } from '@/services/rules-engine/repositories/rule-instance-repository'
import { MongoDbTransactionRepository } from '@/services/rules-engine/repositories/mongodb-transaction-repository'
import { Case } from '@/@types/openapi-internal/Case'
import { hasFeature, tenantSettings } from '@/core/utils/context'
import { AlertsService } from '@/services/alerts'
import { CaseEscalationResponse } from '@/@types/openapi-internal/CaseEscalationResponse'
import { Handlers } from '@/@types/openapi-internal-custom/DefaultApi'
import { getMentionsFromComments, getParsedCommentBody } from '@/utils/helpers'

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
    const dbs = {
      mongoDb: client,
      dynamoDb,
    }
    const caseRepository = new CaseRepository(tenantId, dbs)

    const alertsService = await AlertsService.fromEvent(event)

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

    const settings = await tenantSettings(tenantId)

    const caseCreationService = new CaseCreationService(
      caseRepository,
      userService,
      ruleInstanceRepository,
      transactionRepository,
      settings
    )

    const casesAlertsAuditLogService = new CasesAlertsAuditLogService(
      tenantId,
      { mongoDb: client, dynamoDb }
    )

    const handlers = new Handlers()

    handlers.registerGetCaseList(
      async (ctx, request) =>
        await caseService.getCases(request, {
          hideOptionalData: true,
        })
    )

    handlers.registerPatchCasesStatusChange(async (ctx, request) => {
      const { caseIds, updates } = request.CasesStatusUpdateRequest
      const { oldCases } = await caseService.updateCasesStatus(caseIds, updates)
      await casesAlertsAuditLogService.handleAuditLogForCaseUpdate(
        oldCases,
        updates
      )
      return
    })
    handlers.registerPatchAlertsQaStatus((_ctx, request) =>
      alertsService.updateAlertChecklistQaStatus(
        request.alertId,
        request.AlertChecklistQaUpdateRequest.checklistItemIds,
        request.AlertChecklistQaUpdateRequest.status
      )
    )
    handlers.registerPatchAlertsChecklistStatus((_ctx, request) =>
      alertsService.updateAlertChecklistStatus(
        request.alertId,
        request.AlertChecklistUpdateRequest.checklistItemIds,
        request.AlertChecklistUpdateRequest.done
      )
    )
    handlers.registerPatchAlertsQaAssignments((_ctx, request) =>
      alertsService.updateAlertsQaAssignments(
        request.alertId,
        request.AlertQaAssignmentsUpdateRequest.assignments
      )
    )
    handlers.registerPatchCasesAssignment(async (ctx, request) => {
      const { caseIds, assignments } = request.CasesAssignmentsUpdateRequest
      const existingCases = await caseRepository.getCasesByIds(caseIds)

      await Promise.all([
        caseService.updateCasesAssignments(caseIds, assignments),
        ...caseIds.map(async (caseId) => {
          const oldCase = existingCases.find((c) => c.caseId === caseId)
          await casesAlertsAuditLogService.handleAuditLogForCaseAssignment(
            caseId,
            { assignments: oldCase?.assignments },
            { assignments }
          )
        }),
      ])
    })

    handlers.registerAlertsQaStatusChange(async (ctx, request) => {
      return alertsService.updateAlertQaStatus(
        ctx.userId,
        request.AlertQaStatusUpdateRequest
      )
    })

    handlers.registerAlertsValidateQaStatuses(async (ctx, request) => {
      const isValid = await alertsService.validateAlertsQAStatus(
        request.ValidateAlertsQAStatusRequest.alertIds
      )

      return { valid: isValid }
    })

    handlers.registerDeleteAlertsComment(async (ctx, request) => {
      const { alertId, commentId } = request
      const deleteCommentResult = await alertsService.deleteAlertComment(
        alertId,
        commentId
      )
      await casesAlertsAuditLogService.createAlertAuditLog({
        alertId,
        logAction: 'DELETE',
        oldImage: deleteCommentResult,
        newImage: {},
        subtype: 'COMMENT',
      })
      return
    })

    handlers.registerPatchCasesReviewAssignment(async (ctx, request) => {
      const { caseIds, reviewAssignments } =
        request.CasesReviewAssignmentsUpdateRequest

      const oldCases = await caseRepository.getCasesByIds(caseIds)

      await Promise.all([
        caseService.updateCasesReviewAssignments(caseIds, reviewAssignments),
        ...caseIds.map(async (caseId) => {
          const oldCase = oldCases.find((c) => c.caseId === caseId)
          await casesAlertsAuditLogService.handleAuditLogForCaseAssignment(
            caseId,
            { reviewAssignments: oldCase?.reviewAssignments },
            { reviewAssignments }
          )
        }),
      ])
    })

    handlers.registerGetCase(async (ctx, request) => {
      const caseItem = await caseService.getCase(request.caseId, {
        logAuditLogView: true,
      })
      return caseResponse(caseItem)
    })

    handlers.registerPostCaseComments(async (ctx, request) => {
      const { Comment: comment } = request
      const mentions = getMentionsFromComments(comment.body)
      const saveCommentResult = await caseService.saveCaseComment(
        request.caseId,
        { ...comment, userId, mentions }
      )
      await casesAlertsAuditLogService.handleAuditLogForCasesComments(
        request.caseId,
        {
          ...comment,
          body: getParsedCommentBody(comment.body),
          mentions,
        }
      )
      return saveCommentResult
    })

    handlers.registerDeleteCasesCaseIdCommentsCommentId(
      async (ctx, request) =>
        await caseService.deleteCaseComment(request.caseId, request.commentId)
    )

    handlers.registerGetAlertList(
      async (ctx, request) =>
        await alertsService.getAlerts(request, {
          hideTransactionIds: true,
        })
    )

    handlers.registerPostCasesManual(async (ctx, request) => {
      const case_ = await caseCreationService.createManualCaseFromUser(
        request.ManualCaseCreationDataRequest.manualCaseData,
        request.ManualCaseCreationDataRequest.files,
        request.ManualCaseCreationDataRequest.transactionIds,
        request.ManualCaseCreationDataRequest.priority
      )

      await casesAlertsAuditLogService.createAuditLog({
        caseId: case_?.caseId ?? '',
        logAction: 'CREATE',
        caseDetails: case_, // Removed case transactions to prevent sqs message size limit
        newImage: case_,
        oldImage: {},
        subtype: 'MANUAL_CASE_CREATION',
      })

      return case_
    })

    handlers.registerPatchCasesManual(async (ctx, request) => {
      const case_ = await caseService.getCase(
        request.ManualCasePatchRequest.caseId
      )

      const newCase = await caseService.updateManualCase(
        request.ManualCasePatchRequest
      )

      await casesAlertsAuditLogService.createAuditLog({
        caseId: case_?.caseId ?? '',
        logAction: 'UPDATE',
        caseDetails: newCase,
        newImage: newCase,
        oldImage: case_,
        subtype: 'MANUAL_CASE_TRANSACTIONS_ADDITION',
      })

      return newCase
    })

    handlers.registerGetCaseIds(
      async (ctx, request) =>
        await caseService.getCaseIdsByUserId(request.userId, {
          caseType: request.filterCaseType,
        })
    )

    handlers.registerGetCaseTransactions(
      async (ctx, request) => await caseService.getCasesTransactions(request)
    )

    handlers.registerAlertsStatusChange(async (ctx, request) => {
      const { alertIds, updates } = request.AlertsStatusUpdateRequest
      if (!alertIds?.length) {
        throw new BadRequest('Missing alertIds in request body or empty array')
      }

      const { oldAlerts } = await alertsService.updateAlertsStatus(
        alertIds,
        updates
      )
      return await casesAlertsAuditLogService.handleAuditLogForAlertsUpdate(
        oldAlerts,
        updates
      )
    })

    handlers.registerAlertsAssignment(async (ctx, request) => {
      const { alertIds, assignments } = request.AlertsAssignmentsUpdateRequest

      const existingAlers = await alertsService.getAlertsByIds(alertIds)

      await Promise.all([
        alertsService.updateAlertsAssignments(alertIds, assignments),
        ...alertIds.map(async (alertId) => {
          const oldAlert = existingAlers.find((a) => a.alertId === alertId)

          await casesAlertsAuditLogService.handleAuditLogForAlertAssignment(
            alertId,
            { assignments: oldAlert?.assignments },
            { assignments }
          )
        }),
      ])
    })

    handlers.registerAlertsReviewAssignment(async (ctx, request) => {
      const { alertIds, reviewAssignments } =
        request.AlertsReviewAssignmentsUpdateRequest

      const existingAlerts = await alertsService.getAlertsByIds(alertIds)

      await Promise.all([
        alertsService.updateAlertsReviewAssignments(
          alertIds,
          reviewAssignments
        ),
        ...alertIds.map(async (alertId) => {
          const oldAlert = existingAlerts.find((a) => a.alertId === alertId)

          await casesAlertsAuditLogService.handleAuditLogForAlertAssignment(
            alertId,
            { reviewAssignments: oldAlert?.reviewAssignments },
            { reviewAssignments }
          )
        }),
      ])
    })

    handlers.registerGetAlert(async (ctx, request) => {
      const alert = await alertsService.getAlert(request.alertId)
      if (alert == null) {
        throw new NotFound(`Alert "${request.alertId}" not found`)
      }
      await casesAlertsAuditLogService.createAlertAuditLog({
        alertId: request.alertId,
        logAction: 'VIEW',
        oldImage: {},
        newImage: {},
        alertDetails: alert,
      })
      return alert
    })

    handlers.registerAlertsNoNewCase(async (ctx, request) => {
      const { alertIds, sourceCaseId } = request.AlertsToNewCaseRequest
      const sourceCase = await caseService.getCase(sourceCaseId)
      if (sourceCase == null) {
        throw new NotFound(`Unable to find source case by id "${sourceCaseId}"`)
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
    })

    handlers.registerGetAlertTransactionList(
      async (ctx, request) =>
        await alertsService.getAlertTransactions(request.alertId, request)
    )

    handlers.registerCreateAlertsComment(async (ctx, request) => {
      const { alertId, Comment: comment } = request
      const mentions = getMentionsFromComments(comment.body)
      const saveCommentResult = await alertsService.saveAlertComment(alertId, {
        ...comment,
        userId,
        mentions,
      })

      await casesAlertsAuditLogService.handleAuditLogForAlertsComments(
        alertId,
        {
          ...comment,
          body: getParsedCommentBody(comment.body),
          mentions,
        }
      )

      return saveCommentResult
    })

    handlers.registerPostCasesCaseIdEscalate(async (ctx, request) => {
      if (!hasFeature('ADVANCED_WORKFLOWS')) {
        throw new Forbidden('Feature not enabled')
      }
      const { caseId, CaseEscalationRequest: escalationRequest } = request
      if (
        !escalationRequest.alertEscalations ||
        escalationRequest.alertEscalations.length === 0
      ) {
        const { assigneeIds, oldCase } = await caseService.escalateCase(
          caseId,
          escalationRequest.caseUpdateRequest
        )
        const response: CaseEscalationResponse = {
          childCaseId: undefined,
          assigneeIds,
        }
        await casesAlertsAuditLogService.handleAuditLogForCaseEscalation(
          caseId,
          escalationRequest.caseUpdateRequest,
          oldCase
        )
        return response
      } else if (escalationRequest.alertEscalations) {
        const { childCaseId, assigneeIds } = await alertsService.escalateAlerts(
          caseId,
          escalationRequest
        )
        const response: CaseEscalationResponse = {
          childCaseId,
          assigneeIds,
        }
        return response
      }
      throw new BadRequest('Invalid request of escalation')
    })

    handlers.registerCreateAlertsCommentReply(async (ctx, request) => {
      const { alertId, commentId, Comment: comment } = request
      const mentions = getMentionsFromComments(comment.body)
      const saveCommentResult = await alertsService.saveAlertCommentReply(
        alertId,
        commentId,
        { ...comment, userId, mentions }
      )

      await casesAlertsAuditLogService.handleAuditLogForAlertsComments(
        alertId,
        {
          ...comment,
          body: getParsedCommentBody(comment.body),
          mentions,
        }
      )

      return saveCommentResult
    })

    handlers.registerPostCaseCommentsReply(async (ctx, request) => {
      const { commentId, Comment: comment, caseId } = request
      const mentions = getMentionsFromComments(comment.body)
      const commentCreated = await caseService.saveCommentReply(
        caseId,
        commentId,
        { ...comment, userId, mentions }
      )

      await casesAlertsAuditLogService.handleAuditLogForCasesComments(caseId, {
        ...comment,
        body: getParsedCommentBody(comment.body),
        mentions,
      })
      return commentCreated
    })

    return await handlers.handle(event)
  }
)

function caseResponse(c: Case): Case {
  c.caseTransactionsIds = undefined
  c.alerts?.map((a) => {
    a.transactionIds = []
    return a
  })
  return c
}
