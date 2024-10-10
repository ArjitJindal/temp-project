import {
  APIGatewayEventLambdaAuthorizerContext,
  APIGatewayProxyWithLambdaAuthorizerEvent,
} from 'aws-lambda'
import { Credentials } from '@aws-sdk/client-sts'
import { Document, MongoClient } from 'mongodb'
import { NotFound, BadRequest } from 'http-errors'
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb'
import { Account } from '../accounts'
import { CaseRepository } from '../cases/repository'
import { MongoDbTransactionRepository } from '../rules-engine/repositories/mongodb-transaction-repository'
import { ReportRepository } from './repositories/report-repository'
import { ReportType } from '@/@types/openapi-internal/ReportType'
import {
  REPORT_GENERATORS,
  UNIMPLEMENTED_GENERATORS,
} from '@/services/sar/generators'
import { Report } from '@/@types/openapi-internal/Report'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import { DefaultApiGetReportsRequest } from '@/@types/openapi-internal/RequestParameters'
import { formatCountry } from '@/utils/countries'
import { mergeObjects } from '@/utils/object'
import { traceable } from '@/core/xray'
import { ReportStatus } from '@/@types/openapi-internal/ReportStatus'
import { logger } from '@/core/logger'
import { getContext } from '@/core/utils/context'
import { getDynamoDbClientByEvent } from '@/utils/dynamodb'

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
  mongoDb: MongoClient
  dynamoDb: DynamoDBDocumentClient

  public static async fromEvent(
    event: APIGatewayProxyWithLambdaAuthorizerEvent<
      APIGatewayEventLambdaAuthorizerContext<Credentials>
    >
  ): Promise<ReportService> {
    const { principalId: tenantId } = event.requestContext.authorizer
    const client = await getMongoDbClient()
    const dynamoDb = getDynamoDbClientByEvent(event)
    return new ReportService(tenantId, client, dynamoDb)
  }
  constructor(
    tenantId: string,
    mongoDb: MongoClient,
    dynamoDb: DynamoDBDocumentClient
  ) {
    this.reportRepository = new ReportRepository(tenantId, mongoDb, dynamoDb)
    this.tenantId = tenantId
    this.mongoDb = mongoDb
    this.dynamoDb = dynamoDb
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
    caseId: string,
    alertIds: string[],
    transactionIds: string[]
  ): Promise<Report> {
    if (transactionIds?.length > 20) {
      throw new NotFound(`Cant select more than 20 transactions`)
    }
    const caseRepository = new CaseRepository(this.tenantId, {
      mongoDb: this.mongoDb,
    })
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

    const txpRepo = new MongoDbTransactionRepository(
      this.tenantId,
      this.mongoDb
    )

    const transactions = await txpRepo.getTransactions({
      filterIdList: transactionIds,
      includeUsers: true,
      pageSize: 20,
    })

    const account = getContext()?.user as Account
    const generator = this.getReportGenerator(reportTypeId)
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
      transactions.data,
      account
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
      createdById: account.id,
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
    return await this.reportRepository.getReports(params)
  }

  async getReport(reportId: string): Promise<Report> {
    const report = await this.reportRepository.getReport(reportId)
    if (!report) {
      throw new NotFound(`Cannot find report ${reportId}`)
    }
    return withSchema(report)
  }

  async completeReport(report: Report): Promise<Report> {
    const generator = this.getReportGenerator(report.reportTypeId)
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
      output: (await generator.generate(report.parameters, report)) || '',
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
      this.getReportGenerator(report.reportTypeId)?.getAugmentedReportParams(
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

  private getReportGenerator(reportTypeId: string) {
    const generator = REPORT_GENERATORS.get(reportTypeId)
    if (generator) {
      generator.tenantId = this.tenantId
    }
    return generator
  }
}
