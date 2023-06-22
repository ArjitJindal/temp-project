import {
  APIGatewayEventLambdaAuthorizerContext,
  APIGatewayProxyWithLambdaAuthorizerEvent,
} from 'aws-lambda'
import { NotFound } from 'http-errors'
import { JWTAuthorizerResult } from '@/@types/jwt'
import { lambdaApi } from '@/core/middlewares/lambda-api-middlewares'
import { getMongoDbClient } from '@/utils/mongoDBUtils'
import {
  DefaultApiGetReportsDraftRequest,
  DefaultApiGetReportsRequest,
} from '@/@types/openapi-internal/RequestParameters'
import { Report } from '@/@types/openapi-internal/Report'
import { CaseRepository } from '@/services/rules-engine/repositories/case-repository'
import { getContext } from '@/core/utils/context'
import { Account } from '@/@types/openapi-internal/Account'
import { MongoDbTransactionRepository } from '@/services/rules-engine/repositories/mongodb-transaction-repository'
import { ReportService } from '@/services/sar/service'

export const sarHandler = lambdaApi()(
  async (
    event: APIGatewayProxyWithLambdaAuthorizerEvent<
      APIGatewayEventLambdaAuthorizerContext<JWTAuthorizerResult>
    >
  ) => {
    const { principalId: tenantId } = event.requestContext.authorizer
    const mongoDb = await getMongoDbClient()
    const reportService = await ReportService.fromEvent(event)
    if (event.httpMethod === 'GET' && event.resource === '/report-types') {
      const types = reportService.getTypes()
      return {
        data: types,
        total: types.length,
      }
    }

    if (event.httpMethod === 'POST' && event.resource === '/reports/draft') {
      const params =
        event.queryStringParameters as unknown as DefaultApiGetReportsDraftRequest
      const txnIds =
        event.queryStringParameters?.transactionIds?.split(',') || []
      if (txnIds.length > 20) {
        throw new NotFound(`Cant select more than 20 transactions`)
      }
      const caseRepository = new CaseRepository(tenantId, { mongoDb })
      const c = await caseRepository.getCaseById(params.caseId)
      if (!c) {
        throw new NotFound(`Cannot find case ${params.caseId}`)
      }
      const txpRepo = new MongoDbTransactionRepository(tenantId, mongoDb)
      const transactions = await txpRepo.getTransactions({
        filterIdList: txnIds,
        includeUsers: true,
        pageSize: 20,
      })

      const account = getContext()?.user as Account
      return reportService.getReportDraft(
        params.reportTypeId,
        account,
        c,
        transactions.data
      )
    }

    if (event.httpMethod === 'GET' && event.resource === '/reports') {
      const params = (event.queryStringParameters ||
        {}) as DefaultApiGetReportsRequest
      return reportService.getReports(params)
    }

    if (
      event.httpMethod === 'GET' &&
      event.resource === '/reports/{reportId}' &&
      event.pathParameters?.reportId
    ) {
      return await reportService.getReport(event.pathParameters?.reportId)
    }
    if (
      event.httpMethod === 'POST' &&
      event.resource === '/reports' &&
      event.body
    ) {
      const report: Report = JSON.parse(event.body)
      return reportService.completeReport(report)
    }
    if (
      event.httpMethod === 'POST' &&
      event.resource === '/reports/{reportId}/draft' &&
      event.pathParameters?.reportId &&
      event.body
    ) {
      const report: Report = JSON.parse(event.body)
      return reportService.draftReport(report)
    }
  }
)
