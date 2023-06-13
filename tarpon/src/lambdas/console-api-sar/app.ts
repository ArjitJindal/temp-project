import {
  APIGatewayEventLambdaAuthorizerContext,
  APIGatewayProxyWithLambdaAuthorizerEvent,
} from 'aws-lambda'
import { NotFound } from 'http-errors'
import { JWTAuthorizerResult } from '@/@types/jwt'
import { lambdaApi } from '@/core/middlewares/lambda-api-middlewares'
import { REPORT_GENERATORS, REPORT_SCHEMAS } from '@/services/sar/generators'
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
        data: REPORT_SCHEMAS,
        total: REPORT_SCHEMAS.length,
      }
    }
    if (
      event.httpMethod === 'GET' &&
      event.resource === '/report-schemas/{schemaId}' &&
      event.pathParameters?.schemaId
    ) {
      const { schemaId } = event.pathParameters
      const reportSchema = REPORT_SCHEMAS.find(
        (schema) => schema.id === schemaId
      )
      if (!reportSchema) {
        throw new NotFound(`Cannot find schema ${schemaId}`)
      }

      return reportSchema
    }

    if (event.httpMethod === 'GET' && event.resource === '/reports/template') {
      const params =
        event.queryStringParameters as unknown as DefaultApiGetReportsTemplateRequest
      const reportSchema = REPORT_SCHEMAS.find(
        (schema) => schema.id === params.schemaId
      )
      if (!reportSchema) {
        throw new NotFound(`Cannot find schema ${params.schemaId}`)
      }
      const ReportGenerator = REPORT_GENERATORS.get(reportSchema)
      if (!ReportGenerator) {
        throw new NotFound(`Cannot find report generator`)
      }
      const txnIds =
        event.queryStringParameters?.transactionIds?.split(',') || []
      if (txnIds.length > 20) {
        throw new NotFound(`Cant select more than 20 transactions`)
      }
      const caseRepository = new CaseRepository(tenantId, { mongoDb })
      const reportGenerator = new ReportGenerator()
      const c = await caseRepository.getCaseById(params.caseId)
      if (!c) {
        throw new NotFound(`Cannot find case ${params.caseId}`)
      }
      const account = getContext()?.user as Account
      const parameters = await reportGenerator.prepopulate(c, txnIds, account)
      const now = new Date().valueOf()
      const report: Report = {
        caseId: params.caseId,
        schema: reportSchema,
        createdAt: now,
        updatedAt: now,
        parameters,
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
      return reportRepository.saveOrUpdateReport(report)
    }
  }
)
