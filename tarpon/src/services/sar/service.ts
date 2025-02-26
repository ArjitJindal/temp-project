import {
  APIGatewayEventLambdaAuthorizerContext,
  APIGatewayProxyWithLambdaAuthorizerEvent,
} from 'aws-lambda'
import { Credentials } from '@aws-sdk/client-sts'
import { Document, MongoClient } from 'mongodb'
import { BadRequest, NotFound } from 'http-errors'
import { S3 } from '@aws-sdk/client-s3'
import { Upload } from '@aws-sdk/lib-storage'
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb'
import { CaseRepository } from '../cases/repository'
import { MongoDbTransactionRepository } from '../rules-engine/repositories/mongodb-transaction-repository'
import { RiskScoringV8Service } from '../risk-scoring/risk-scoring-v8-service'
import { LogicEvaluator } from '../logic-evaluator/engine'
import { CaseService } from '../cases'
import { ReportRepository } from './repositories/report-repository'
import { ReportType } from '@/@types/openapi-internal/ReportType'
import {
  REPORT_GENERATORS,
  UNIMPLEMENTED_GENERATORS,
} from '@/services/sar/generators'
import { Report } from '@/@types/openapi-internal/Report'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import {
  DefaultApiGetReportsRequest,
  DefaultApiDeleteReportsRequest,
} from '@/@types/openapi-internal/RequestParameters'
import { formatCountry } from '@/utils/countries'
import { mergeObjects } from '@/utils/object'
import { traceable } from '@/core/xray'
import { ReportStatus } from '@/@types/openapi-internal/ReportStatus'
import { logger } from '@/core/logger'
import { getContext } from '@/core/utils/context'
import { getS3ClientByEvent } from '@/utils/s3'
import { getDynamoDbClientByEvent } from '@/utils/dynamodb'
import { UserRepository } from '@/services/users/repositories/user-repository'
import { getUserName } from '@/utils/helpers'
import { FINCEN_REPORT_VALID_STATUSS } from '@/@types/openapi-internal-custom/FincenReportValidStatus'
import { NON_FINCEN_REPORT_VALID_STATUSS } from '@/@types/openapi-internal-custom/NonFincenReportValidStatus'
import { Account } from '@/@types/openapi-internal/Account'
import {
  auditLog,
  AuditLogEntity,
  AuditLogReturnData,
  getReportAuditLogMetadata,
} from '@/utils/audit-log'

// Custom AuditLogReturnData types
type SarCreationAuditLogReturnData = AuditLogReturnData<
  Report,
  object,
  Report | Partial<Report>
>

type SarUpdateAuditLogReturnData = AuditLogReturnData<
  void,
  Report | Partial<Report>,
  Report | Partial<Report>
>

type SarDeleteAuditLogReturnData = AuditLogReturnData<void>

function withSchema(report: Report): Report {
  const generator = REPORT_GENERATORS.get(report.reportTypeId)
  return {
    ...report,
    schema: generator?.getSchema(),
  }
}

type S3Config = {
  documentBucket: string
}

@traceable
export class ReportService {
  reportRepository!: ReportRepository
  tenantId: string
  mongoDb: MongoClient
  riskScoringService: RiskScoringV8Service
  caseService: CaseService
  s3: S3
  s3Config: S3Config
  dynamoDb: DynamoDBDocumentClient

  public static async fromEvent(
    event: APIGatewayProxyWithLambdaAuthorizerEvent<
      APIGatewayEventLambdaAuthorizerContext<Credentials>
    >
  ): Promise<ReportService> {
    const { principalId: tenantId } = event.requestContext.authorizer
    const client = await getMongoDbClient()
    const dynamoDb = getDynamoDbClientByEvent(event)
    const s3 = getS3ClientByEvent(event)
    const { DOCUMENT_BUCKET } = process.env as {
      DOCUMENT_BUCKET: string
    }

    return new ReportService(tenantId, client, dynamoDb, s3, {
      documentBucket: DOCUMENT_BUCKET,
    })
  }

  constructor(
    tenantId: string,
    mongoDb: MongoClient,
    dynamoDb: DynamoDBDocumentClient,
    s3: S3,
    s3Config: S3Config
  ) {
    this.reportRepository = new ReportRepository(tenantId, mongoDb, dynamoDb)
    this.tenantId = tenantId
    this.mongoDb = mongoDb
    this.dynamoDb = dynamoDb
    const logicEvaluator = new LogicEvaluator(tenantId, dynamoDb)
    this.riskScoringService = new RiskScoringV8Service(
      tenantId,
      logicEvaluator,
      { dynamoDb, mongoDb }
    )
    this.s3 = s3
    this.s3Config = s3Config
    const caseRepository = new CaseRepository(tenantId, { mongoDb })
    this.caseService = new CaseService(caseRepository, s3, {
      tmpBucketName: this.s3Config.documentBucket,
      documentBucketName: this.s3Config.documentBucket,
    })
  }

  public getTypes(): ReportType[] {
    const types: ReportType[] = []
    for (const [id, generator] of REPORT_GENERATORS.entries()) {
      const type = generator.getType()
      types.push({
        country: formatCountry(type.countryCode) || 'Unknown',
        countryCode: type.countryCode,
        directSubmission: type.directSubmission,
        subjectType: type.subjectTypes,
        id,
        implemented: true,
        type: type.type,
        reportStatuses: type.directSubmission
          ? FINCEN_REPORT_VALID_STATUSS
          : NON_FINCEN_REPORT_VALID_STATUSS,
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
          reportStatuses: NON_FINCEN_REPORT_VALID_STATUSS,
        })
      )
    )
  }

  public async getUserReportDraft(
    reportTypeId: string,
    userId: string,
    alertIds?: string[],
    transactionIds?: string[]
  ): Promise<Report> {
    if (transactionIds != null && transactionIds.length > 20) {
      throw new NotFound(`Cant select more than 20 transactions`)
    }
    const userRepository = new UserRepository(this.tenantId, {
      dynamoDb: this.dynamoDb,
      mongoDb: this.mongoDb,
    })
    const user = await userRepository.getUserById(userId)
    if (!user) {
      throw new NotFound(`Cannot find user ${userId}`)
    }

    const txpRepo = new MongoDbTransactionRepository(
      this.tenantId,
      this.mongoDb
    )

    const transactions = await txpRepo.getTransactions({
      filterUserId: userId,
      pageSize: 100,
    })

    const account = getContext()?.user as Account
    const generator = this.getReportGenerator(reportTypeId)
    if (!generator) {
      throw new NotFound(`Cannot find report generator`)
    }
    generator.tenantId = this.tenantId
    const lastGeneratedReport =
      await this.reportRepository.getLastGeneratedReport(reportTypeId)

    const populatedParameters = await generator.getUserPopulatedParameters(
      user,
      transactions.data,
      account
    )

    const prefillReport = mergeObjects(
      lastGeneratedReport?.parameters.report,
      populatedParameters.report
    )
    const now = new Date().valueOf()

    const report: Report = {
      name: getUserName(user),
      description: `SAR report for ${getUserName(user)}`,
      reportTypeId,
      createdAt: now,
      updatedAt: now,
      createdById: account.id,
      status: 'DRAFT' as ReportStatus,
      parameters: {
        ...populatedParameters,
        report: prefillReport,
      },
      comments: [],
      revisions: [],
      caseUserId: userId,
    }
    const userTransactions = await this.caseService.getUserTransactions(userId)
    report.parameters.transactions = report.parameters.transactions?.filter(
      (tx) => userTransactions.includes(tx.id)
    )
    const savedReport = await this.reportRepository.saveOrUpdateReport(report)
    await this.riskScoringService.handleReRunTriggers('SAR', {
      userIds: [report.caseUserId],
    }) // To rerun risk scores for user
    return withSchema(savedReport)
  }

  public async getCaseReportDraft(
    reportTypeId: string,
    caseId: string,
    alertIds?: string[],
    transactionIds?: string[]
  ): Promise<Report> {
    if (transactionIds != null && transactionIds.length > 20) {
      throw new NotFound(`Cant select more than 20 transactions`)
    }

    const caseRepository = new CaseRepository(this.tenantId, {
      mongoDb: this.mongoDb,
    })
    const c = await caseRepository.getCaseById(caseId)
    if (!c) {
      throw new NotFound(`Cannot find case ${caseId}`)
    }
    if (!transactionIds || transactionIds.length === 0) {
      transactionIds = c.caseTransactionsIds || []
    }

    const txpRepo = new MongoDbTransactionRepository(
      this.tenantId,
      this.mongoDb
    )

    const transactions = await txpRepo.getTransactions({
      filterIdList: transactionIds ?? [],
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
      status: 'DRAFT' as ReportStatus,
      parameters: {
        ...populatedParameters,
        report: prefillReport,
      },
      comments: [],
      revisions: [],
      caseUserId:
        c.caseUsers?.origin?.userId ?? c.caseUsers?.destination?.userId ?? '',
    }
    const caseTransactions = await this.caseService.getCaseTransactions(caseId)
    report.parameters.transactions = report.parameters.transactions?.filter(
      (tx) => caseTransactions.includes(tx.id)
    )
    const savedReport = await this.reportRepository.saveOrUpdateReport(report)
    await this.riskScoringService.handleReRunTriggers('SAR', {
      userIds: [report.caseUserId],
    }) // To rerun risk scores for user
    return withSchema(savedReport)
  }

  async getReports(params: DefaultApiGetReportsRequest) {
    return await this.reportRepository.getReports(params)
  }

  @auditLog('SAR', 'SAR_DELETE', 'DELETE')
  async deleteReports(
    params: DefaultApiDeleteReportsRequest
  ): Promise<SarDeleteAuditLogReturnData> {
    await this.reportRepository.deleteReports(
      params.ReportsDeleteRequest.reportIds
    )
    const auditLogEntities: AuditLogEntity<object>[] = []
    params.ReportsDeleteRequest.reportIds.map((id) =>
      auditLogEntities.push({
        entityId: id,
      })
    )
    return {
      result: undefined,
      entities: auditLogEntities,
    }
  }

  async getReport(reportId: string): Promise<Report> {
    const report = await this.reportRepository.getReport(reportId)
    if (!report) {
      throw new NotFound(`Cannot find report ${reportId}`)
    }
    return withSchema(report)
  }

  @auditLog('SAR', 'CREATION', 'CREATE')
  async completeReport(report: Report): Promise<SarCreationAuditLogReturnData> {
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
    report.status = 'COMPLETE' as ReportStatus
    const generationResult = await generator.generate(report.parameters, report)
    const now = Date.now()
    if (generationResult?.type === 'STRING') {
      report.revisions.push({
        output: generationResult.value,
        createdAt: now,
      })
    } else {
      const key = `${this.tenantId}/${
        report.id
      }-report-${now}.${generationResult.contentType.toLowerCase()}`
      const stream = generationResult.stream
      const buffers: Buffer[] = []
      for await (const data of stream) {
        if (typeof data !== 'string') {
          buffers.push(data)
        }
      }
      const body = Buffer.concat(buffers)
      const parallelUploadS3 = new Upload({
        client: this.s3,
        params: {
          Bucket: this.s3Config.documentBucket,
          Key: key,
          Body: body,
        },
      })
      await parallelUploadS3.done()

      report.revisions.push({
        output: `s3:document:${key}`,
        createdAt: now,
      })
    }

    if (directSubmission && generator.submit) {
      logger.info('Submitting report')
      report.status = 'SUBMITTING' as ReportStatus
      report.statusInfo = await generator.submit(report)
      logger.info('Submitted report')
    }

    const savedReport = await this.reportRepository.saveOrUpdateReport(report)

    await this.riskScoringService.handleReRunTriggers('SAR', {
      userIds: [report.caseUserId],
    }) // To rerun risk scores for user
    return {
      result: withSchema(savedReport),
      entities: [
        {
          entityId: savedReport.id ?? '',
          newImage: savedReport,
          logMetadata: getReportAuditLogMetadata(savedReport),
        },
      ],
    }
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
    report.status = 'DRAFT' as ReportStatus
    report.updatedAt = Date.now()
    report.parameters =
      this.getReportGenerator(report.reportTypeId)?.getAugmentedReportParams(
        report
      ) ?? report.parameters
    const savedReport = await this.reportRepository.saveOrUpdateReport(report)
    await this.riskScoringService.handleReRunTriggers('SAR', {
      userIds: [report.caseUserId],
    }) // To rerun risk scores for user
    return withSchema(savedReport)
  }

  @auditLog('SAR', 'SAR_UPDATE', 'UPDATE')
  async updateReportStatus(
    reportId: string,
    status: ReportStatus,
    statusInfo?: string
  ): Promise<SarUpdateAuditLogReturnData> {
    const report = await this.getReport(reportId)
    await this.reportRepository.updateReportStatus(reportId, status, statusInfo)
    return {
      result: undefined,
      entities: [
        {
          entityId: report.id ?? '-',
          logMetadata: getReportAuditLogMetadata(report),
          oldImage: { status: report.status, statusInfo: report.statusInfo },
          newImage: { status, statusInfo },
        },
      ],
    }
  }

  private getReportGenerator(reportTypeId: string) {
    const generator = REPORT_GENERATORS.get(reportTypeId)
    if (generator) {
      generator.tenantId = this.tenantId
    }
    return generator
  }
}
