import {
  APIGatewayEventLambdaAuthorizerContext,
  APIGatewayProxyWithLambdaAuthorizerEvent,
} from 'aws-lambda'
import { JWTAuthorizerResult } from '@/@types/jwt'
import { lambdaApi } from '@/core/middlewares/lambda-api-middlewares'
import { ReportService } from '@/services/sar/service'
import { Handlers } from '@/@types/openapi-internal-custom/DefaultApi'
import { parseReportXMLResponse } from '@/services/batch-jobs/fincen-report-status-fetch'

export const sarHandler = lambdaApi()(
  async (
    event: APIGatewayProxyWithLambdaAuthorizerEvent<
      APIGatewayEventLambdaAuthorizerContext<JWTAuthorizerResult>
    >
  ) => {
    const reportService = await ReportService.fromEvent(event)
    const handlers = new Handlers()

    handlers.registerGetReportTypes(async () => {
      const types = reportService.getTypes()
      return {
        data: types,
        total: types.length,
      }
    })

    handlers.registerGetReportsDraft(async (ctx, request) => {
      if (request.caseId != null && request.userId != null) {
        throw new Error(`Only one of userId or caseId should be passed`)
      } else if (request.caseId != null) {
        return await reportService.getCaseReportDraft(
          request.reportTypeId,
          request.caseId,
          request.alertIds,
          request.transactionIds
        )
      } else if (request.userId != null) {
        return await reportService.getUserReportDraft(
          request.reportTypeId,
          request.userId,
          request.alertIds,
          request.transactionIds
        )
      }
      throw new Error(`Either userId or caseId is required`)
    })

    handlers.registerGetReports(
      async (ctx, request) => await reportService.getReports(request)
    )

    handlers.registerGetReportsReportId(
      async (ctx, request) => await reportService.getReport(request.reportId)
    )

    handlers.registerDeleteReports(
      async (ctx, request) => await reportService.deleteReports(request)
    )

    handlers.registerPostReportsReportIdStatus(async (ctx, request) => {
      const status = request.ReportStatusUpdateRequest.status
      let statusInfo = request.ReportStatusUpdateRequest.statusInfo
      const result = await parseReportXMLResponse(statusInfo)
      statusInfo = result.statusInfo
      await reportService.updateReportStatus(
        request.reportId,
        status,
        statusInfo
      )
    })

    handlers.registerPostReports(async (ctx, request) => {
      return await reportService.completeReport(request.Report)
    })

    handlers.registerPostReportsReportIdDraft(
      async (ctx, request) => await reportService.draftReport(request.Report)
    )

    return await handlers.handle(event)
  }
)
