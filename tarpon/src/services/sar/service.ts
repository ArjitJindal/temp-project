import {
  APIGatewayEventLambdaAuthorizerContext,
  APIGatewayProxyWithLambdaAuthorizerEvent,
} from 'aws-lambda'
import * as AWS from 'aws-sdk'
import { MongoClient } from 'mongodb'
import { NotFound } from 'http-errors'
import { Account } from '../accounts'
import { ReportRepository } from './repositories/report-repository'
import { ReportType } from '@/@types/openapi-internal/ReportType'
import {
  REPORT_GENERATORS,
  UNIMPLEMENTED_GENERATORS,
} from '@/services/sar/generators'
import { Report } from '@/@types/openapi-internal/Report'
import { getMongoDbClient } from '@/utils/mongoDBUtils'
import { Case } from '@/@types/openapi-internal/Case'
import { InternalTransaction } from '@/@types/openapi-internal/InternalTransaction'
import { DefaultApiGetReportsRequest } from '@/@types/openapi-internal/RequestParameters'
import { formatCountry } from '@/utils/countries'

export class ReportService {
  reportRepository!: ReportRepository

  public static async fromEvent(
    event: APIGatewayProxyWithLambdaAuthorizerEvent<
      APIGatewayEventLambdaAuthorizerContext<AWS.STS.Credentials>
    >
  ): Promise<ReportService> {
    const { principalId: tenantId } = event.requestContext.authorizer
    const client = await getMongoDbClient()
    return new ReportService(tenantId, client)
  }
  constructor(tenantId: string, mongoDb: MongoClient) {
    this.reportRepository = new ReportRepository(tenantId, mongoDb)
  }

  public getTypes(): ReportType[] {
    const types: ReportType[] = []
    for (const [id, generator] of REPORT_GENERATORS.entries()) {
      const type = generator.getType()
      types.push({
        country: formatCountry(type.countryCode) || 'Unknown',
        countryCode: type.countryCode,
        id,
        implemented: true,
        type: type.type,
      })
    }

    // For demos, append some generators we want to implement.
    return types.concat(
      UNIMPLEMENTED_GENERATORS.map(
        ([countryCode, type]): ReportType => ({
          country: formatCountry(countryCode) || 'Unknown',
          countryCode,
          id: `${countryCode}-${type}`,
          implemented: false,
          type,
        })
      )
    )
  }

  public async getReportDraft(
    reportTypeId: string,
    reporter: Account,
    c: Case,
    transactions: InternalTransaction[]
  ): Promise<Report> {
    const reportId = await this.reportRepository.getId()
    const generator = REPORT_GENERATORS.get(reportTypeId)
    if (!c.caseId) {
      throw new NotFound(`No case ID`)
    }
    if (!generator) {
      throw new NotFound(`Cannot find report generator`)
    }
    const lastGeneratedReport =
      await this.reportRepository.getLastGeneratedReport(reportTypeId)

    const populatedSchema = generator.getPopulatedSchema(
      reportId,
      c,
      transactions,
      reporter
    )
    const now = new Date().valueOf()

    const report: Report = {
      id: reportId,
      name: c.caseId,
      description: `SAR report for ${c.caseId}`,
      caseId: c.caseId,
      schema: populatedSchema.schema,
      reportTypeId,
      createdAt: now,
      updatedAt: now,
      createdById: reporter.id,
      status: 'draft',
      parameters: {
        ...populatedSchema.params,
        report: {
          ...(lastGeneratedReport?.parameters?.report || {}),
          ...populatedSchema.params.report,
        },
      },
      comments: [],
      revisions: [],
    }
    return this.reportRepository.saveOrUpdateReport(report)
  }

  getReports(params: DefaultApiGetReportsRequest) {
    return this.reportRepository.getReports(params)
  }

  async getReport(reportId: string): Promise<Report> {
    const report = await this.reportRepository.getReport(reportId)
    if (!report) {
      throw new NotFound(`Cannot find report ${reportId}`)
    }
    return report
  }

  async completeReport(report: Report): Promise<Report> {
    report.status = 'complete'
    report.revisions.push({
      output:
        REPORT_GENERATORS.get(report.reportTypeId)?.generate(
          report.parameters
        ) || '',
      createdAt: Date.now(),
    })
    return await this.reportRepository.saveOrUpdateReport(report)
  }

  async draftReport(report: Report): Promise<Report> {
    report.status = 'draft'
    report.updatedAt = Date.now()
    return await this.reportRepository.saveOrUpdateReport(report)
  }
}
