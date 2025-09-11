import {
  APIGatewayEventLambdaAuthorizerContext,
  APIGatewayProxyWithLambdaAuthorizerEvent,
} from 'aws-lambda'
import { NotFound, BadRequest, Forbidden } from 'http-errors'
import uniq from 'lodash/uniq'
import { CaseService } from '../../services/cases'
import { TransactionService } from '../console-api-transaction/services/transaction-service'
import { lambdaApi } from '@/core/middlewares/lambda-api-middlewares'
import { JWTAuthorizerResult } from '@/@types/jwt'
import { CaseCreationService } from '@/services/cases/case-creation-service'
import { Case } from '@/@types/openapi-internal/Case'
import { AlertTransactionsStats } from '@/@types/openapi-internal/AlertTransactionsStats'
import { hasFeature } from '@/core/utils/context'
import { AlertsService } from '@/services/alerts'
import { Handlers } from '@/@types/openapi-internal-custom/DefaultApi'
import { CommentsResponseItem } from '@/@types/openapi-internal/CommentsResponseItem'
import { sendBatchJobCommand } from '@/services/batch-jobs/batch-job'
import { getContext } from '@/core/utils/context-storage'

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
    const [alertsService, caseService, caseCreationService] = await Promise.all(
      [
        AlertsService.fromEvent(event),
        CaseService.fromEvent(event),
        CaseCreationService.fromEvent(event),
      ]
    )

    const handlers = new Handlers()

    handlers.registerCreateCaseReport(async (_ctx, request) => {
      return (
        await caseService.createReport({
          caseId: request.caseId,
          afterTimestamp: request.CreateCaseParams.afterTimestamp,
          addUserOrPaymentDetails:
            request.CreateCaseParams.addUserOrPaymentDetails,
          addActivity: request.CreateCaseParams.addActivity,
          addTransactions: request.CreateCaseParams.addTransactions,
          addAlertDetails: request.CreateCaseParams.addAlertDetails,
          addOntology: request.CreateCaseParams.addOntology,
        })
      ).result
    })

    handlers.registerGetCaseList(async (ctx, request) => {
      const data = await caseService.getCases(request, {
        hideOptionalData: true,
      })
      return data.result
    })

    handlers.registerPatchAlertsQaStatus(async (_ctx, request) => {
      const result = await alertsService.updateAlertChecklistQaStatus(
        request.alertId,
        request.AlertChecklistQaUpdateRequest.checklistItemIds,
        request.AlertChecklistQaUpdateRequest.status
      )
      return result.result
    })

    handlers.registerPatchAlertsChecklistStatus(async (_ctx, request) => {
      const result = await alertsService.updateAlertChecklistStatus(
        request.alertId,
        request.AlertChecklistUpdateRequest.checklistItemIds,
        request.AlertChecklistUpdateRequest.done,
        request.AlertChecklistUpdateRequest.comment
      )
      return result.result
    })

    handlers.registerPatchAlertsQaAssignments((_ctx, request) =>
      alertsService.updateAlertsQaAssignments(
        request.alertId,
        request.AlertQaAssignmentsUpdateRequest.assignments
      )
    )

    handlers.registerAlertsQaStatusChange(async (ctx, request) => {
      const response = await alertsService.updateAlertQaStatus(
        request.AlertQaStatusUpdateRequest
      )
      return response.result
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

    handlers.registerGetAlertsQaSample(async (ctx, request) => {
      const data = await alertsService.getSamplingById(request.sampleId)
      // TODO FDT-7285: remove alertIds from payload
      return data
    })

    handlers.registerGetAlertsQaSampleIds(
      async () => await alertsService.getSamplingIds()
    )

    handlers.registerDeleteAlertsQaSample(
      async (ctx, request) =>
        await alertsService.deleteSamplingById(request.sampleId)
    )

    handlers.registerAlertsValidateQaStatuses(
      async (ctx, request) =>
        await alertsService.validateAlertsQAStatus(
          request.ValidateAlertsQAStatusRequest.alertIds
        )
    )

    handlers.registerPatchAlertsQaSample(async (ctx, request) => {
      const data = await alertsService.patchSamplingById(
        request.sampleId,
        request.AlertsQaSamplingUpdateRequest
      )
      // TODO FDT-7285: remove alertIds from payload
      return data
    })

    handlers.registerGetCase(async (ctx, request) => {
      const response = await caseService.getCase(request.caseId, {
        logAuditLogView: true,
      })
      return caseResponse(response.result, true)
    })
    handlers.registerDeleteCasesCaseIdCommentsCommentId(
      async (ctx, request) => {
        const response = await caseService.deleteCaseComment(
          request.caseId,
          request.commentId
        )
        return response.result
      }
    )

    handlers.registerGetAlertList(async (ctx, request) => {
      const data = await alertsService.getAlerts(request, {
        hideTransactionIds: true,
        sampleId: request.sampleId,
      })
      return data.result
    })

    handlers.registerPostCasesManual(async (ctx, request) => {
      const response = await caseCreationService.createManualCaseFromUser(
        request.ManualCaseCreationDataRequest.manualCaseData,
        request.ManualCaseCreationDataRequest.files,
        request.ManualCaseCreationDataRequest.transactionIds,
        request.ManualCaseCreationDataRequest.priority
      )
      return response.result
    })

    handlers.registerPatchCasesManual(async (ctx, request) => {
      const response = await caseService.updateManualCase(
        request.ManualCasePatchRequest
      )
      return response.result
    })

    handlers.registerGetCaseIds(
      async (ctx, request) =>
        await caseService.getCaseIdsByUserId(request.userId, {
          caseType: request.filterCaseTypes,
        })
    )

    handlers.registerGetCaseTransactions(async (ctx, request) => {
      const transactionService = await TransactionService.fromEvent(event)
      return await transactionService.getCasesTransactions(request)
    })

    handlers.registerGetAlert(async (ctx, request) => {
      return (await alertsService.getAlert(request.alertId, { auditLog: true }))
        .result
    })

    handlers.registerAlertsNoNewCase(async (ctx, request) => {
      const { alertIds, sourceCaseId } = request.AlertsToNewCaseRequest
      const sourceCase = (await caseService.getCase(sourceCaseId)).result

      if (sourceCase == null) {
        throw new NotFound(`Unable to find source case by id "${sourceCaseId}"`)
      }

      const newCase = (
        await caseCreationService.createNewCaseFromAlerts(sourceCase, alertIds)
      ).result

      return caseResponse(newCase)
    })

    handlers.registerGetAlertTransactionList(async (ctx, request) => {
      const transactionService = await TransactionService.fromEvent(event)

      return await transactionService.getAlertsTransaction(request)
    })

    handlers.registerGetComments(async (ctx, request) => {
      const caseIds = request?.filterEntityIds?.filter((id) =>
        id.startsWith('C-')
      )
      const alertIds = request?.filterEntityIds?.filter((id) =>
        id.startsWith('A-')
      )

      const promises: Promise<CommentsResponseItem[]>[] = []

      if (request.filterEntityTypes?.includes('CASE') && caseIds?.length) {
        promises.push(caseService.getComments(caseIds))
      }

      if (request.filterEntityTypes?.includes('ALERT') && alertIds?.length) {
        promises.push(alertsService.getComments(alertIds))
      }
      const responses = await Promise.all(promises)

      return { items: responses.flatMap((r) => r) }
    })

    handlers.registerGetAlertTransactionStats(
      async (ctx, request): Promise<AlertTransactionsStats> => {
        const transactionService = await TransactionService.fromEvent(event)

        const alert = (await alertsService.getAlert(request.alertId)).result

        const transactionCursor = transactionService.getTransactionCursor({
          filterIdList: alert.transactionIds ?? [],
        })

        const referenceCurrency = request.referenceCurrency ?? 'USD'

        const userIds: string[] = []
        let totalTransactionsAmount = 0
        for await (const transaction of transactionCursor) {
          const amount =
            await transactionService.transactionRepository.getAmount(
              transaction,
              referenceCurrency
            )
          totalTransactionsAmount += amount
          if (transaction.destinationUserId) {
            userIds.push(transaction.destinationUserId)
          }
        }

        return {
          totalTransactionsAmount: {
            amount: totalTransactionsAmount,
            currency: referenceCurrency,
          },
          numberOfUsersTransactedWith: uniq(userIds).length,
        }
      }
    )

    /** Escalation */
    handlers.registerPostCasesCaseIdEscalate(async (ctx, request) => {
      if (!hasFeature('ADVANCED_WORKFLOWS')) {
        throw new Forbidden('Feature not enabled')
      }

      const { caseId, CaseEscalationRequest } = request
      const { alertEscalations, caseUpdateRequest } = CaseEscalationRequest

      // if there are no alerts to escalate, simply escalate the case
      if (!alertEscalations?.length) {
        const response = await caseService.escalateCase(
          caseId,
          caseUpdateRequest
        )
        return response.result
        // else escalate the alerts together with the case
      } else if (alertEscalations) {
        const response = await alertsService.escalateAlerts(
          caseId,
          CaseEscalationRequest
        )
        return response.result
      }

      throw new BadRequest('Invalid request of escalation')
    })

    /** Status Change */
    handlers.registerAlertsStatusChange(async (ctx, request) => {
      const response = await alertsService.updateStatus(
        request.AlertsStatusUpdateRequest.alertIds,
        request.AlertsStatusUpdateRequest.updates
      )
      return response.result
    })

    handlers.registerPatchCasesStatusChange(async (ctx, request) => {
      const response = await caseService.updateStatus(
        request.CasesStatusUpdateRequest.caseIds,
        request.CasesStatusUpdateRequest.updates
      )
      return response.result
    })

    /** Assignments and Review Assignments */
    handlers.registerAlertsReviewAssignment(async (ctx, request) => {
      const response = await alertsService.updateReviewAssignments(
        request.AlertsReviewAssignmentsUpdateRequest.alertIds,
        request.AlertsReviewAssignmentsUpdateRequest.reviewAssignments
      )

      return response.result
    })

    handlers.registerAlertsAssignment(async (ctx, request) => {
      const response = await alertsService.updateAssignments(
        request.AlertsAssignmentsUpdateRequest.alertIds,
        request.AlertsAssignmentsUpdateRequest.assignments
      )
      return response.result
    })

    handlers.registerPatchCasesAssignment(async (ctx, request) => {
      const response = await caseService.updateAssignments(
        request.CasesAssignmentsUpdateRequest.caseIds,
        request.CasesAssignmentsUpdateRequest.assignments
      )
      return response.result
    })

    handlers.registerPatchCasesReviewAssignment(async (ctx, request) => {
      const response = await caseService.updateReviewAssignments(
        request.CasesReviewAssignmentsUpdateRequest.caseIds,
        request.CasesReviewAssignmentsUpdateRequest.reviewAssignments
      )
      return response.result
    })

    /** Comments APIs */
    handlers.registerCreateAlertsComment(async (ctx, request) => {
      const response = await alertsService.saveComment(
        request.alertId,
        request.CommentRequest
      )

      return response.result
    })

    handlers.registerPostCaseComments(async (ctx, request) => {
      const response = await caseService.saveComment(
        request.caseId,
        request.CommentRequest
      )
      return response.result
    })

    handlers.registerCreateAlertsCommentReply(
      async (ctx, request) =>
        await alertsService.saveCommentReply(
          request.alertId,
          request.commentId,
          request.CommentRequest
        )
    )

    handlers.registerPostCaseCommentsReply(async (ctx, request) => {
      const response = await caseService.saveCommentReply(
        request.caseId,
        request.commentId,
        request.CommentRequest
      )
      return response.result
    })

    handlers.registerDeleteAlertsComment(async (ctx, request) => {
      const response = await alertsService.deleteComment(
        request.alertId,
        request.commentId
      )
      return response.result
    })

    handlers.registerGenerateCaseEddReport(async (ctx, request) => {
      await sendBatchJobCommand({
        tenantId: ctx.tenantId,
        type: 'EDD_REVIEW',
        parameters: {
          caseId: request.caseId,
          createdBy: ctx.userId,
          auth0Domain: getContext()?.auth0Domain ?? '',
          userId: request.EDDReportRequest.userId,
        },
      })
    })

    return await handlers.handle(event)
  }
)

function caseResponse(
  c: Case,
  pickOnlyAlertsMandatoryFields: boolean = false
): Case {
  c.caseTransactionsIds = undefined
  c.alerts?.map((a) => {
    a.transactionIds = []
    return a
  })
  if (pickOnlyAlertsMandatoryFields) {
    c.alerts = c.alerts?.map((a) => ({
      alertId: a.alertId,
      createdTimestamp: a.createdTimestamp,
      ruleInstanceId: a.ruleInstanceId,
      ruleName: a.ruleName,
      ruleDescription: a.ruleDescription,
      ruleId: a.ruleId,
      ruleAction: a.ruleAction,
      numberOfTransactionsHit: a.numberOfTransactionsHit,
      priority: a.priority,
    }))
  }
  return c
}
