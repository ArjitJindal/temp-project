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

    handlers.registerGetReportTypes(async (ctx, request) => {
      const getAllReport = request.allReportType ?? false
      const types = reportService.getTypes(getAllReport)
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
      async (ctx, request) => (await reportService.getReports(request)).result
    )

    handlers.registerGetReportsReportId(
      async (ctx, request) => await reportService.getReport(request.reportId)
    )

    handlers.registerDeleteReports(async (ctx, request) => {
      const response = await reportService.deleteReports(request)
      return response.result
    })

    handlers.registerPostReportsReportIdStatus(async (ctx, request) => {
      const status = request.ReportStatusUpdateRequest.status
      let statusInfo = request.ReportStatusUpdateRequest.statusInfo
      const result = await parseReportXMLResponse(ctx.tenantId, statusInfo)
      statusInfo = result.statusInfo
      await reportService.updateReportStatus(
        request.reportId,
        status,
        statusInfo
      )
    })

    handlers.registerPostReports(async (ctx, request) => {
      const response = await reportService.completeReport(request.Report)
      return response.result
    })

    handlers.registerPostReportsReportIdDraft(
      async (_ctx, request) =>
        (await reportService.draftReport(request.Report)).result
    )

    return await handlers.handle(event)
  }
)
