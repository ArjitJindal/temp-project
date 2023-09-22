import {
  APIGatewayEventLambdaAuthorizerContext,
  APIGatewayProxyWithLambdaAuthorizerEvent,
} from 'aws-lambda'
import { Credentials } from '@aws-sdk/client-sts'
import { Document, MongoClient } from 'mongodb'
import { NotFound, BadRequest } from 'http-errors'
import { Account } from '../accounts'
import { ReportRepository } from './repositories/report-repository'
import { ReportType } from '@/@types/openapi-internal/ReportType'
import {
  REPORT_GENERATORS,
  UNIMPLEMENTED_GENERATORS,
} from '@/services/sar/generators'
import { Report } from '@/@types/openapi-internal/Report'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import { Case } from '@/@types/openapi-internal/Case'
import { InternalTransaction } from '@/@types/openapi-internal/InternalTransaction'
import { DefaultApiGetReportsRequest } from '@/@types/openapi-internal/RequestParameters'
import { formatCountry } from '@/utils/countries'
import { mergeObjects } from '@/utils/object'
import { traceable } from '@/core/xray'
import { ReportStatus } from '@/@types/openapi-internal/ReportStatus'
import { logger } from '@/core/logger'

function withSchema(report: Report): Report {
  const generator = REPORT_GENERATORS.get(report.reportTypeId)
  return {
    ...report,
    schema: generator?.getSchema(),
  }
}

@traceable
export class ReportService {
  reportRepository!: ReportRepository
  tenantId: string

  public static async fromEvent(
    event: APIGatewayProxyWithLambdaAuthorizerEvent<
      APIGatewayEventLambdaAuthorizerContext<Credentials>
    >
  ): Promise<ReportService> {
    const { principalId: tenantId } = event.requestContext.authorizer
    const client = await getMongoDbClient()
    return new ReportService(tenantId, client)
  }
  constructor(tenantId: string, mongoDb: MongoClient) {
    this.reportRepository = new ReportRepository(tenantId, mongoDb)
    this.tenantId = tenantId
  }

  public getTypes(): ReportType[] {
    const types: ReportType[] = []
    for (const [id, generator] of REPORT_GENERATORS.entries()) {
      const type = generator.getType()
      types.push({
        country: formatCountry(type.countryCode) || 'Unknown',
        countryCode: type.countryCode,
        directSubmission: type.directSubmission,
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
          directSubmission: false,
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
    const generator = REPORT_GENERATORS.get(reportTypeId)
    if (!c.caseId) {
      throw new NotFound(`No case ID`)
    }
    if (!generator) {
      throw new NotFound(`Cannot find report generator`)
    }
    generator.tenantId = this.tenantId
    const lastGeneratedReport =
      await this.reportRepository.getLastGeneratedReport(reportTypeId)

    const populatedParameters = await generator.getPopulatedParameters(
      c,
      transactions,
      reporter
    )
    const prefillReport = mergeObjects(
      lastGeneratedReport?.parameters.report,
      populatedParameters.report
    )
    const now = new Date().valueOf()

    const report: Report = {
      name: c.caseId,
      description: `SAR report for ${c.caseId}`,
      caseId: c.caseId,
      reportTypeId,
      createdAt: now,
      updatedAt: now,
      createdById: reporter.id,
      status: 'DRAFT',
      parameters: {
        ...populatedParameters,
        report: prefillReport,
      },
      comments: [],
      revisions: [],
      caseUserId:
        c.caseUsers?.origin?.userId ?? c.caseUsers?.destination?.userId ?? '',
    }
    const savedReport = await this.reportRepository.saveOrUpdateReport(report)
    return withSchema(savedReport)
  }

  async getReports(params: DefaultApiGetReportsRequest) {
    const result = await this.reportRepository.getReports(params)
    return {
      ...result,
      items: result.items.map(withSchema),
    }
  }

  async getReport(reportId: string): Promise<Report> {
    const report = await this.reportRepository.getReport(reportId)
    if (!report) {
      throw new NotFound(`Cannot find report ${reportId}`)
    }
    return withSchema(report)
  }

  async completeReport(report: Report): Promise<Report> {
    const generator = REPORT_GENERATORS.get(report.reportTypeId)
    if (!generator) {
      throw new BadRequest(
        `No report generator found for ${report.reportTypeId}`
      )
    }
    const { directSubmission } = generator.getType()
    report.parameters =
      generator?.getAugmentedReportParams(report) ?? report.parameters
    report.id = report.id ?? (await this.reportRepository.getId())
    report.status = 'COMPLETE'
    report.revisions.push({
      output: generator.generate(report.parameters, report) || '',
      createdAt: Date.now(),
    })

    if (directSubmission && generator.submit) {
      logger.info('Submitting report')
      report.status = 'SUBMITTING'
      report.statusInfo = await generator.submit(report)
      logger.info('Submitted report')
    }

    const savedReport = await this.reportRepository.saveOrUpdateReport(report)
    return withSchema(savedReport)
  }

  public async reportsFiledForUser(
    userId: string,
    project: Document = {}
  ): Promise<{
    total: number
    items: Partial<Report>[]
  }> {
    return await this.reportRepository.reportsFiledForUser(userId, project)
  }

  async draftReport(report: Report): Promise<Report> {
    report.status = 'DRAFT'
    report.updatedAt = Date.now()
    report.parameters =
      REPORT_GENERATORS.get(report.reportTypeId)?.getAugmentedReportParams(
        report
      ) ?? report.parameters
    return withSchema(await this.reportRepository.saveOrUpdateReport(report))
  }

  async updateReportStatus(
    reportId: string,
    status: ReportStatus,
    statusInfo?: string
  ): Promise<void> {
    await this.reportRepository.updateReportStatus(reportId, status, statusInfo)
  }
}
