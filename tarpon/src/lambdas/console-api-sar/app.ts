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
  DefaultApiGetReportsRequest,
  DefaultApiGetReportsTemplateRequest,
} from '@/@types/openapi-internal/RequestParameters'
import { Report } from '@/@types/openapi-internal/Report'
import { CaseRepository } from '@/services/rules-engine/repositories/case-repository'
import { getContext } from '@/core/utils/context'
import { Account } from '@/@types/openapi-internal/Account'

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

    if (event.httpMethod === 'GET' && event.resource === '/reports/template') {
      const params =
        event.queryStringParameters as unknown as DefaultApiGetReportsTemplateRequest
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
      const parameters = generator.prepopulate(c, txnIds, account)
      const now = new Date().valueOf()
      const report: Report = {
        caseId: params.caseId,
        schema: generator.getSchema(),
        createdAt: now,
        updatedAt: now,
        parameters,
        comments: [],
        revisions: [],
      }
      return report
    }

    if (event.httpMethod === 'GET' && event.resource === '/reports') {
      const params = (event.queryStringParameters ||
        {}) as DefaultApiGetReportsRequest
      return reportRepository.getReports(params)
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

      report.output = REPORT_GENERATORS.get(report.schema.id)?.generate(
        report.parameters
      )
      return reportRepository.saveOrUpdateReport(report)
    }
  }
)
