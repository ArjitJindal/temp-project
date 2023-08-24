import {
  APIGatewayEventLambdaAuthorizerContext,
  APIGatewayProxyWithLambdaAuthorizerEvent,
} from 'aws-lambda'
import { NotFound } from 'http-errors'
import { JWTAuthorizerResult } from '@/@types/jwt'
import { lambdaApi } from '@/core/middlewares/lambda-api-middlewares'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import { CaseRepository } from '@/services/rules-engine/repositories/case-repository'
import { getContext } from '@/core/utils/context'
import { Account } from '@/@types/openapi-internal/Account'
import { MongoDbTransactionRepository } from '@/services/rules-engine/repositories/mongodb-transaction-repository'
import { ReportService } from '@/services/sar/service'
import { Handlers } from '@/@types/openapi-internal-custom/DefaultApi'

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
      const { reportTypeId, caseId, transactionIds } = request
      if (transactionIds?.length > 20) {
        throw new NotFound(`Cant select more than 20 transactions`)
      }
      const caseRepository = new CaseRepository(tenantId, { mongoDb })
      const c = await caseRepository.getCaseById(caseId)
      if (!c) {
        throw new NotFound(`Cannot find case ${caseId}`)
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

    handlers.registerPostReports(
      async (ctx, request) => await reportService.completeReport(request.Report)
    )

    handlers.registerPostReportsReportIdDraft(
      async (ctx, request) => await reportService.draftReport(request.Report)
    )

    return await handlers.handle(event)
  }
)
