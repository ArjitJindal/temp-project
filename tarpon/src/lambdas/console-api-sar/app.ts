import {
  APIGatewayEventLambdaAuthorizerContext,
  APIGatewayProxyWithLambdaAuthorizerEvent,
} from 'aws-lambda'
import { JWTAuthorizerResult, assertCurrentUserRole } from '@/@types/jwt'
import { lambdaApi } from '@/core/middlewares/lambda-api-middlewares'
import { ReportService } from '@/services/sar/service'
import { Handlers } from '@/@types/openapi-internal-custom/DefaultApi'
import { ask } from '@/utils/openai'
import { logger } from '@/core/logger'

export const sarHandler = lambdaApi()(
  async (
    event: APIGatewayProxyWithLambdaAuthorizerEvent<
      APIGatewayEventLambdaAuthorizerContext<JWTAuthorizerResult>
    >
  ) => {
    const reportService = await ReportService.fromEvent(event)
    const handlers = new Handlers()

    handlers.registerGetReportTypes(async () => ({
      data: reportService.getTypes(),
      total: reportService.getTypes().length,
    }))

    handlers.registerGetReportsDraft(
      async (ctx, request) =>
        await reportService.getReportDraft(
          request.reportTypeId,
          request.caseId,
          request.alertIds,
          request.transactionIds
        )
    )

    handlers.registerGetReports(
      async (ctx, request) => await reportService.getReports(request)
    )

    handlers.registerGetReportsReportId(
      async (ctx, request) => await reportService.getReport(request.reportId)
    )

    handlers.registerPostReportsReportIdStatus(async (ctx, request) => {
      // Only super admin can manually update a report's status for now
      assertCurrentUserRole('root')
      const status = request.ReportStatusUpdateRequest.status
      let statusInfo = request.ReportStatusUpdateRequest.statusInfo
      const report = await reportService.getReport(request.reportId)
      if (
        report.reportTypeId === 'US-SAR' &&
        statusInfo.includes('BSAEFilingBatchMessages')
      ) {
        try {
          const result = await ask(
            `Please transform the following error messages in XML format into a human-readable format. Please only return the transformed output. And the output includes two sections - 1. Batch Status 2. Error Messages.\n---\n${statusInfo}`
          )
          statusInfo = result.substring(result.indexOf('Batch Status'))
        } catch (e) {
          logger.error(e)
          statusInfo = `\`\`\`${statusInfo}\`\`\``
        }
      }

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
