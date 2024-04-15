import {
  APIGatewayEventLambdaAuthorizerContext,
  APIGatewayProxyWithLambdaAuthorizerEvent,
} from 'aws-lambda'
import { NotFound, BadRequest, Forbidden } from 'http-errors'
import { CaseService } from '../../services/cases'
import { lambdaApi } from '@/core/middlewares/lambda-api-middlewares'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import { JWTAuthorizerResult } from '@/@types/jwt'
import { getDynamoDbClientByEvent } from '@/utils/dynamodb'
import { CaseCreationService } from '@/services/cases/case-creation-service'
import { Case } from '@/@types/openapi-internal/Case'
import { hasFeature } from '@/core/utils/context'
import { AlertsService } from '@/services/alerts'
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
    const { principalId: tenantId } = event.requestContext.authorizer
    const client = await getMongoDbClient()
    const dynamoDb = await getDynamoDbClientByEvent(event)
    const alertsService = await AlertsService.fromEvent(event)

    const caseService = await CaseService.fromEvent(event)

    const caseCreationService = new CaseCreationService(tenantId, {
      mongoDb: client,
      dynamoDb,
    })

    const handlers = new Handlers()

    handlers.registerGetCaseList(
      async (ctx, request) =>
        await caseService.getCases(request, {
          hideOptionalData: true,
        })
    )

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

    handlers.registerAlertsQaStatusChange(async (ctx, request) => {
      return alertsService.updateAlertQaStatus(
        ctx.userId,
        request.AlertQaStatusUpdateRequest
      )
    })

    handlers.registerCreateAlertsQaSampling(
      async (ctx, request) =>
        await alertsService.createAlertsQaSampling(
          request.AlertsQaSamplingRequest
        )
    )

    handlers.registerGetAlertsQaSampling(
      async (ctx, request) => await alertsService.getSamplingData(request)
    )

    handlers.registerGetAlertsQaSample(
      async (ctx, request) =>
        await alertsService.getSamplingById(request.sampleId)
    )

    handlers.registerAlertsValidateQaStatuses(
      async (ctx, request) =>
        await alertsService.validateAlertsQAStatus(
          request.ValidateAlertsQAStatusRequest.alertIds
        )
    )

    handlers.registerPatchAlertsQaSample(
      async (ctx, request) =>
        await alertsService.patchSamplingById(
          request.sampleId,
          request.AlertsQaSamplingUpdateRequest
        )
    )

    handlers.registerGetCase(async (ctx, request) =>
      caseResponse(
        await caseService.getCase(request.caseId, { logAuditLogView: true })
      )
    )

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

    handlers.registerPostCasesManual(
      async (ctx, request) =>
        await caseCreationService.createManualCaseFromUser(
          request.ManualCaseCreationDataRequest.manualCaseData,
          request.ManualCaseCreationDataRequest.files,
          request.ManualCaseCreationDataRequest.transactionIds,
          request.ManualCaseCreationDataRequest.priority
        )
    )

    handlers.registerPatchCasesManual(
      async (ctx, request) =>
        await caseService.updateManualCase(request.ManualCasePatchRequest)
    )

    handlers.registerGetCaseIds(
      async (ctx, request) =>
        await caseService.getCaseIdsByUserId(request.userId, {
          caseType: request.filterCaseType,
        })
    )

    handlers.registerGetCaseTransactions(
      async (ctx, request) => await caseService.getCasesTransactions(request)
    )

    handlers.registerGetAlert(
      async (ctx, request) =>
        await alertsService.getAlert(request.alertId, { auditLog: true })
    )

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

      return caseResponse(newCase)
    })

    handlers.registerGetAlertTransactionList(
      async (ctx, request) =>
        await alertsService.getAlertTransactions(request.alertId, request)
    )

    /** Escalation */
    handlers.registerPostCasesCaseIdEscalate(async (ctx, request) => {
      if (!hasFeature('ADVANCED_WORKFLOWS')) {
        throw new Forbidden('Feature not enabled')
      }

      const { caseId, CaseEscalationRequest } = request
      const { alertEscalations, caseUpdateRequest } = CaseEscalationRequest

      if (!alertEscalations?.length) {
        return await caseService.escalateCase(caseId, caseUpdateRequest)
      } else if (alertEscalations) {
        return await alertsService.escalateAlerts(caseId, CaseEscalationRequest)
      }

      throw new BadRequest('Invalid request of escalation')
    })

    /** Status Change */
    handlers.registerAlertsStatusChange(
      async (ctx, request) =>
        await alertsService.updateStatus(
          request.AlertsStatusUpdateRequest.alertIds,
          request.AlertsStatusUpdateRequest.updates
        )
    )

    handlers.registerPatchCasesStatusChange(
      async (ctx, request) =>
        await caseService.updateStatus(
          request.CasesStatusUpdateRequest.caseIds,
          request.CasesStatusUpdateRequest.updates
        )
    )

    /** Assignments and Review Assignments */
    handlers.registerAlertsReviewAssignment(
      async (ctx, request) =>
        await alertsService.updateReviewAssignments(
          request.AlertsReviewAssignmentsUpdateRequest.alertIds,
          request.AlertsReviewAssignmentsUpdateRequest.reviewAssignments
        )
    )

    handlers.registerAlertsAssignment(
      async (ctx, request) =>
        await alertsService.updateAssignments(
          request.AlertsAssignmentsUpdateRequest.alertIds,
          request.AlertsAssignmentsUpdateRequest.assignments
        )
    )

    handlers.registerPatchCasesAssignment(
      async (ctx, request) =>
        await caseService.updateAssignments(
          request.CasesAssignmentsUpdateRequest.caseIds,
          request.CasesAssignmentsUpdateRequest.assignments
        )
    )

    handlers.registerPatchCasesReviewAssignment(
      async (ctx, request) =>
        await caseService.updateReviewAssignments(
          request.CasesReviewAssignmentsUpdateRequest.caseIds,
          request.CasesReviewAssignmentsUpdateRequest.reviewAssignments
        )
    )

    /** Comments APIs */
    handlers.registerCreateAlertsComment(
      async (ctx, request) =>
        await alertsService.saveComment(request.alertId, request.Comment)
    )

    handlers.registerPostCaseComments(
      async (ctx, request) =>
        await caseService.saveComment(request.caseId, request.Comment)
    )

    handlers.registerCreateAlertsCommentReply(
      async (ctx, request) =>
        await alertsService.saveCommentReply(
          request.alertId,
          request.commentId,
          request.Comment
        )
    )

    handlers.registerPostCaseCommentsReply(
      async (ctx, request) =>
        await caseService.saveCommentReply(
          request.caseId,
          request.commentId,
          request.Comment
        )
    )

    handlers.registerDeleteAlertsComment(
      async (ctx, request) =>
        await alertsService.deleteComment(request.alertId, request.commentId)
    )

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
