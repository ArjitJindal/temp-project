import {
  APIGatewayEventLambdaAuthorizerContext,
  APIGatewayProxyWithLambdaAuthorizerEvent,
} from 'aws-lambda'
import { NotFound, BadRequest } from 'http-errors'
import { flatten } from 'lodash'
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
import { hasFeature } from '@/core/utils/context'
import { AlertsService } from '@/services/alerts'
import { TenantRepository } from '@/services/tenants/repositories/tenant-repository'
import { CaseEscalationResponse } from '@/@types/openapi-internal/CaseEscalationResponse'
import { Handlers } from '@/@types/openapi-internal-custom/DefaultApi'

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

    const tenantRepository = new TenantRepository(tenantId, {
      dynamoDb,
    })

    const tenantSettings = await tenantRepository.getTenantSettings()

    const caseCreationService = new CaseCreationService(
      caseRepository,
      userService,
      ruleInstanceRepository,
      transactionRepository,
      tenantSettings
    )

    const casesAlertsAuditLogService = new CasesAlertsAuditLogService(
      tenantId,
      { mongoDb: client, dynamoDb }
    )

    const handlers = new Handlers()

    handlers.registerGetCaseList(
      async (ctx, request) => await caseService.getCases(request)
    )

    handlers.registerPatchCasesStatusChange(async (ctx, request) => {
      const { caseIds, updates } = request.CasesStatusUpdateRequest
      const updateResult = await caseService.updateCasesStatus(caseIds, updates)
      await casesAlertsAuditLogService.handleAuditLogForCaseUpdate(
        caseIds,
        updates,
        'STATUS_CHANGE'
      )
      return updateResult
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
      await caseService.updateCasesAssignments(caseIds, assignments)
      return await casesAlertsAuditLogService.handleAuditLogForCaseUpdate(
        caseIds,
        { assignments },
        'ASSIGNMENT'
      )
    })

    handlers.registerAlertsQaStatusChange(async (ctx, request) => {
      return alertsService.updateAlertQaStatus(
        ctx.userId,
        request.AlertQaStatusUpdateRequest
      )
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

      await caseService.updateCasesReviewAssignments(caseIds, reviewAssignments)
      return await casesAlertsAuditLogService.handleAuditLogForCaseUpdate(
        caseIds,
        { reviewAssignments }
      )
    })

    handlers.registerGetCase(async (ctx, request) => {
      const caseItem = await caseService.getCase(request.caseId, {
        logAuditLogView: true,
      })
      return caseResponse(caseItem)
    })

    handlers.registerPostCaseComments(async (ctx, request) => {
      const { Comment: comment } = request
      const saveCommentResult = await caseService.saveCaseComment(
        request.caseId,
        { ...comment, userId }
      )
      await casesAlertsAuditLogService.handleAuditLogForComments(
        request.caseId,
        comment
      )
      return saveCommentResult
    })

    handlers.registerDeleteCasesCaseIdCommentsCommentId(
      async (ctx, request) =>
        await caseService.deleteCaseComment(request.caseId, request.commentId)
    )

    handlers.registerGetAlertList(
      async (ctx, request) => await alertsService.getAlerts(request)
    )

    handlers.registerPostCasesManual(async (ctx, request) => {
      const case_ = await caseService.createManualCaseFromUser(
        request.ManualCaseCreationDataRequest.manualCaseData,
        request.ManualCaseCreationDataRequest.files,
        request.ManualCaseCreationDataRequest.transactionIds
      )

      await casesAlertsAuditLogService.createAuditLog({
        caseId: case_?.caseId ?? '',
        logAction: 'CREATE',
        caseDetails: { ...case_, caseTransactions: undefined }, // Removed case transactions to prevent sqs message size limit
        newImage: { ...case_, caseTransactions: undefined }, // Removed case transactions to prevent sqs message size limit
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
        caseDetails: {
          ...newCase,
          caseTransactions: undefined, // Removed case transactions to prevent sqs message size limit
        },
        newImage: {
          ...newCase,
          caseTransactions: undefined, // Removed case transactions to prevent sqs message size limit
        },
        oldImage: {
          ...case_,
          caseTransactions: undefined, // Removed case transactions to prevent sqs message size limit
        },
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
      await alertsService.updateAlertsStatus(alertIds, updates)
      return await casesAlertsAuditLogService.handleAuditLogForAlertsUpdate(
        alertIds,
        updates,
        'STATUS_CHANGE'
      )
    })

    handlers.registerAlertsAssignment(async (ctx, request) => {
      const { alertIds, assignments } = request.AlertsAssignmentsUpdateRequest
      await alertsService.updateAlertsAssignments(alertIds, assignments)
      return await casesAlertsAuditLogService.handleAuditLogForAlertsUpdate(
        alertIds,
        { assignments },
        'ASSIGNMENT'
      )
    })

    handlers.registerAlertsReviewAssignment(async (ctx, request) => {
      const { alertIds, reviewAssignments } =
        request.AlertsReviewAssignmentsUpdateRequest
      await alertsService.updateAlertsReviewAssignments(
        alertIds,
        reviewAssignments
      )
      return await casesAlertsAuditLogService.handleAuditLogForAlertsUpdate(
        alertIds,
        { reviewAssignments }
      )
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
    })

    handlers.registerPostCasesCaseIdEscalate(async (ctx, request) => {
      if (!hasFeature('ESCALATION')) {
        throw new BadRequest('Feature not enabled')
      }
      const { caseId, CaseEscalationRequest: escalationRequest } = request
      if (
        !escalationRequest.alertEscalations ||
        escalationRequest.alertEscalations.length === 0
      ) {
        if (!escalationRequest.caseUpdateRequest) {
          throw new BadRequest('Case update request not provided')
        }
        const { assigneeIds } = await caseService.escalateCase(
          caseId,
          escalationRequest.caseUpdateRequest
        )
        const response: CaseEscalationResponse = {
          childCaseId: undefined,
          assigneeIds,
        }
        const caseItem = await caseService.getCase(caseId)
        await casesAlertsAuditLogService.handleAuditLogForCaseUpdate(
          [caseId],
          {
            reason: escalationRequest.caseUpdateRequest.reason,
            caseStatus: caseItem.caseStatus,
          },
          'STATUS_CHANGE'
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
        const alertIds = escalationRequest.alertEscalations.map(
          (escalationObject) => escalationObject.alertId
        )
        const updatedTransactions = escalationRequest.alertEscalations
          .map((item) => item.transactionIds)
          .filter((item) => item != undefined) as string[][]
        const alertItem = await alertsService.getAlert(alertIds[0])
        if (childCaseId) {
          await casesAlertsAuditLogService.handleAuditLogForCaseUpdate(
            [caseId],
            {
              files: escalationRequest.caseUpdateRequest?.files,
              caseStatus: 'ESCALATED',
              alertCaseId: childCaseId,
              updatedAlertIds: alertIds,
            },
            'STATUS_CHANGE'
          )
        }
        await casesAlertsAuditLogService.handleAuditLogForAlertsUpdate(
          alertIds,
          {
            reason: escalationRequest.caseUpdateRequest?.reason,
            files: escalationRequest.caseUpdateRequest?.files,
            alertStatus: alertItem?.alertStatus,
            alertCaseId: childCaseId,
            updatedTransactions: flatten(updatedTransactions).length
              ? flatten(updatedTransactions)
              : undefined,
          },
          'STATUS_CHANGE'
        )
        return response
      }
      throw new BadRequest('Invalid request of escalation')
    })

    return await handlers.handle(event)
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
