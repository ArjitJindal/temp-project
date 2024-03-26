import {
  APIGatewayEventLambdaAuthorizerContext,
  APIGatewayProxyWithLambdaAuthorizerEvent,
} from 'aws-lambda'
import { NotFound } from 'http-errors'
import { JWTAuthorizerResult, assertCurrentUserRole } from '@/@types/jwt'
import { lambdaApi } from '@/core/middlewares/lambda-api-middlewares'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import { CaseRepository } from '@/services/rules-engine/repositories/case-repository'
import { getContext } from '@/core/utils/context'
import { Account } from '@/@types/openapi-internal/Account'
import { MongoDbTransactionRepository } from '@/services/rules-engine/repositories/mongodb-transaction-repository'
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
    const mongoDb = await getMongoDbClient()
    const reportService = await ReportService.fromEvent(event)
    const handlers = new Handlers()

    handlers.registerGetReportTypes(async () => ({
      data: reportService.getTypes(),
      total: reportService.getTypes().length,
    }))

    handlers.registerGetReportsDraft(async (ctx, request) => {
      const { tenantId } = ctx
      const { reportTypeId, caseId, alertIds } = request
      let { transactionIds } = request
      if (transactionIds?.length > 20) {
        throw new NotFound(`Cant select more than 20 transactions`)
      }

      const caseRepository = new CaseRepository(tenantId, { mongoDb })
      const c = await caseRepository.getCaseById(caseId)
      if (!c) {
        throw new NotFound(`Cannot find case ${caseId}`)
      }
      if (
        (!transactionIds || transactionIds.length === 0) &&
        alertIds?.length > 0
      ) {
        transactionIds = c.caseTransactionsIds || []
      }

      const txpRepo = new MongoDbTransactionRepository(tenantId, mongoDb)
      const transactions = await txpRepo.getTransactions({
        filterIdList: transactionIds,
        includeUsers: true,
        pageSize: 20,
      })

      const account = getContext()?.user as Account
      return await reportService.getReportDraft(
        reportTypeId,
        account,
        c,
        transactions.data
      )
    })

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
