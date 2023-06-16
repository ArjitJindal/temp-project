import {
  APIGatewayEventLambdaAuthorizerContext,
  APIGatewayProxyWithLambdaAuthorizerEvent,
} from 'aws-lambda'
import { NotFound } from 'http-errors'
import { JWTAuthorizerResult } from '@/@types/jwt'
import { lambdaApi } from '@/core/middlewares/lambda-api-middlewares'
import { REPORT_GENERATORS } from '@/services/sar/generators'
import { ReportRepository } from '@/services/sar/repositories/report-repository'
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

export const sarHandler = lambdaApi()(
  async (
    event: APIGatewayProxyWithLambdaAuthorizerEvent<
      APIGatewayEventLambdaAuthorizerContext<JWTAuthorizerResult>
    >
  ) => {
    const { principalId: tenantId } = event.requestContext.authorizer
    const mongoDb = await getMongoDbClient()
    const reportRepository = new ReportRepository(tenantId, mongoDb)

    if (event.httpMethod === 'GET' && event.resource === '/report-schemas') {
      return {
        data: Array.from(REPORT_GENERATORS.values()).map((rg) =>
          rg.getSchema()
        ),
        total: REPORT_GENERATORS.size,
      }
    }
    if (
      event.httpMethod === 'GET' &&
      event.resource === '/report-schemas/{schemaId}' &&
      event.pathParameters?.schemaId
    ) {
      const { schemaId } = event.pathParameters
      const generator = REPORT_GENERATORS.get(schemaId)
      if (!generator) {
        throw new NotFound(`Cannot find schema ${schemaId}`)
      }
      return generator.getSchema()
    }

    if (event.httpMethod === 'POST' && event.resource === '/reports/draft') {
      const params =
        event.queryStringParameters as unknown as DefaultApiGetReportsDraftRequest
      const generator = REPORT_GENERATORS.get(params.schemaId)
      if (!generator) {
        throw new NotFound(`Cannot find report generator`)
      }
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
      const account = getContext()?.user as Account
      const reportId = await reportRepository.getId()

      const txpRepo = new MongoDbTransactionRepository(tenantId, mongoDb)

      const transactions = await txpRepo.getTransactions({
        filterIdList: txnIds,
        includeUsers: true,
        pageSize: 20,
      })

      const parameters = generator.prepopulate(
        reportId,
        c,
        transactions.data,
        account
      )
      const now = new Date().valueOf()

      const schema = generator.getSchema()
      const report: Report = {
        id: reportId,
        name: params.caseId,
        description: `SAR report for ${params.caseId}`,
        caseId: params.caseId,
        schema: schema,
        schemaId: schema.id,
        createdAt: now,
        updatedAt: now,
        createdById: account.id,
        status: 'draft',
        parameters,
        comments: [],
        revisions: [],
      }
      return reportRepository.saveOrUpdateReport(report)
    }

    if (event.httpMethod === 'GET' && event.resource === '/reports') {
      const params = (event.queryStringParameters ||
        {}) as DefaultApiGetReportsRequest
      const reports = await reportRepository.getReports(params)
      reports.items = reports.items.map((r) => {
        r.schema = REPORT_GENERATORS.get(r.schemaId)?.getSchema()
        return r
      })
      return reports
    }

    if (
      event.httpMethod === 'GET' &&
      event.resource === '/reports/{reportId}' &&
      event.pathParameters?.reportId
    ) {
      const report = await reportRepository.getReport(
        event.pathParameters?.reportId
      )
      if (!report) {
        throw new NotFound(
          `Cannot find report ${event.pathParameters?.reportId}`
        )
      }
      return report
    }
    if (
      event.httpMethod === 'POST' &&
      event.resource === '/reports' &&
      event.body
    ) {
      const report: Report = JSON.parse(event.body)

      report.status = 'complete'
      report.revisions.push({
        output:
          REPORT_GENERATORS.get(report.schemaId)?.generate(report.parameters) ||
          '',
        createdAt: Date.now(),
      })
      const updatedReport = await reportRepository.saveOrUpdateReport(report)
      updatedReport.schema = REPORT_GENERATORS.get(report.schemaId)?.getSchema()
      return updatedReport
    }
  }
)
