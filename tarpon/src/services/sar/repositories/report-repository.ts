import { Document, Filter, MongoClient, WithId } from 'mongodb'
import { chunk, compact, omit } from 'lodash'
import { StackConstants } from '@lib/constants'
import {
  DynamoDBDocumentClient,
  GetCommand,
  GetCommandInput,
  UpdateCommand,
  UpdateCommandInput,
} from '@aws-sdk/lib-dynamodb'
import { Upload } from '@aws-sdk/lib-storage'
import {
  S3Client,
  DeleteObjectsCommand,
  DeleteObjectsCommandInput,
} from '@aws-sdk/client-s3'
import { Report } from '@/@types/openapi-internal/Report'
import { paginatePipeline, prefixRegexMatchFilter } from '@/utils/mongodb-utils'
import {
  REPORT_COLLECTION,
  USERS_COLLECTION,
} from '@/utils/mongodb-definitions'
import { DefaultApiGetReportsRequest } from '@/@types/openapi-internal/RequestParameters'
import { Account } from '@/@types/openapi-internal/Account'
import { getContext } from '@/core/utils/context-storage'
import { traceable } from '@/core/xray'
import { ReportStatus } from '@/@types/openapi-internal/ReportStatus'
import { CounterRepository } from '@/services/counter/repository'
import { SarDetails } from '@/@types/openapi-internal/SarDetails'
import { DynamoDbKeys } from '@/core/dynamodb/dynamodb-keys'
import { CountryCode } from '@/@types/openapi-public/CountryCode'
import { sendMessageToMongoConsumer } from '@/utils/clickhouse/utils'

@traceable
export class ReportRepository {
  tenantId: string
  mongoDb: MongoClient
  dynamoDb: DynamoDBDocumentClient

  constructor(
    tenantId: string,
    mongoDb: MongoClient,
    dynamoDb: DynamoDBDocumentClient
  ) {
    this.tenantId = tenantId
    this.mongoDb = mongoDb
    this.dynamoDb = dynamoDb
  }

  public async getId(): Promise<string> {
    const counterRepository = new CounterRepository(this.tenantId, {
      mongoDb: this.mongoDb,
      dynamoDb: this.dynamoDb,
    })
    const count = await counterRepository.getNextCounterAndUpdate('Report')

    return `RP-${count}`
  }

  public async reportsFiledForUser(
    userId: string,
    project: Document = {}
  ): Promise<{ total: number; items: Partial<Report>[] }> {
    const db = this.mongoDb.db()
    const collection = db.collection<Report>(REPORT_COLLECTION(this.tenantId))
    const data = await collection
      .find({ caseUserId: userId })
      .project(project)
      .toArray()
    return {
      total: data.length,
      items: data,
    }
  }

  public async getReportsDataForUserFromDynamo(
    userId: string
  ): Promise<SarDetails[]> {
    const getCommandInput: GetCommandInput = {
      TableName: StackConstants.TARPON_DYNAMODB_TABLE_NAME(this.tenantId),
      Key: DynamoDbKeys.SAR_ITEMS(this.tenantId, userId),
    }
    if (!this.dynamoDb) {
      throw new Error('DynamoDB client not initialized')
    }
    const response = await this.dynamoDb?.send(new GetCommand(getCommandInput))
    if (!response || !response.Item) {
      return []
    }
    return response?.Item.sarDetails as SarDetails[]
  }

  public async addOrUpdateSarItemsInDynamo(
    userId: string,
    updatedSarItem: SarDetails
  ) {
    if (!this.dynamoDb) {
      throw new Error('DynamoDB client not initialized')
    }

    const getCommandInput = {
      TableName: StackConstants.TARPON_DYNAMODB_TABLE_NAME(this.tenantId),
      Key: DynamoDbKeys.SAR_ITEMS(this.tenantId, userId),
    }

    const response = await this.dynamoDb.send(new GetCommand(getCommandInput))

    let sarDetails: SarDetails[] = []

    if (response && response.Item && response.Item.sarDetails) {
      sarDetails = response.Item.sarDetails
    }

    const reportIndex = sarDetails.findIndex(
      (item) => item.reportId === updatedSarItem.reportId
    )

    if (reportIndex !== -1) {
      sarDetails[reportIndex].status = updatedSarItem.status
    } else {
      sarDetails.push(updatedSarItem)
    }

    const updateCommandInput: UpdateCommandInput = {
      TableName: StackConstants.TARPON_DYNAMODB_TABLE_NAME(this.tenantId),
      Key: DynamoDbKeys.SAR_ITEMS(this.tenantId, userId),
      UpdateExpression: 'SET sarDetails = :updatedSarDetails',
      ExpressionAttributeValues: {
        ':updatedSarDetails': sarDetails,
      },
      ReturnValues: 'UPDATED_NEW',
    }

    await this.dynamoDb.send(new UpdateCommand(updateCommandInput))
  }

  public async saveOrUpdateReport(reportPayload: Report): Promise<Report> {
    const db = this.mongoDb.db()
    const collection = db.collection<Report>(REPORT_COLLECTION(this.tenantId))

    const existingReport =
      reportPayload.id != null
        ? await collection.findOne({ id: reportPayload.id })
        : undefined

    let newReport: Report
    if (existingReport) {
      if (existingReport.status === 'DRAFT') {
        newReport = {
          ...existingReport,
          ...reportPayload,
        }
      } else {
        let topParent: WithId<Report> | null = existingReport
        while (topParent?.hierarchy?.parentId != null) {
          topParent = await collection.findOne({
            id: topParent.hierarchy.parentId,
          })
        }
        if (topParent == null) {
          throw new Error(`Unable to find parent`)
        }
        const childrenCount = topParent.hierarchy?.childIds?.length ?? 0
        const childReportId = `${reportPayload.id}.${childrenCount + 1}`
        newReport = {
          ...existingReport,
          ...reportPayload,
          id: childReportId,
          hierarchy: {
            parentId: reportPayload.id,
          },
        }
        await collection.replaceOne(
          {
            _id: topParent._id,
          },
          {
            ...topParent,
            hierarchy: {
              ...topParent.hierarchy,
              childIds: [
                ...(topParent.hierarchy?.childIds ?? []),
                childReportId,
              ],
            },
          },
          { upsert: false }
        )
      }
    } else {
      newReport = {
        ...reportPayload,
        id: reportPayload.id ?? (await this.getId()),
        createdAt: Date.now(),
      }
    }

    await collection.replaceOne(
      {
        _id: newReport.id as any,
      },
      omit(newReport, '_id'),
      {
        upsert: true,
      }
    )
    await sendMessageToMongoConsumer({
      documentKey: { type: 'id', value: newReport.id ?? '' },
      operationType: 'update',
      clusterTime: Date.now(),
      collectionName: REPORT_COLLECTION(this.tenantId),
    })

    await this.addOrUpdateSarItemsInDynamo(newReport.caseUserId, {
      reportId: newReport.id ?? '',
      status: newReport.status,
      region: newReport.reportTypeId?.split('-')[0] as CountryCode,
      createdAt: newReport.createdAt,
    })
    return newReport
  }

  public async getReport(reportId: string): Promise<Report | null> {
    const db = this.mongoDb.db()
    const collection = db.collection<Report>(REPORT_COLLECTION(this.tenantId))
    const report = await collection.findOne({ _id: reportId as any })
    return report ? omit(report, '_id') : null
  }

  private getConditionsFromParams(params: DefaultApiGetReportsRequest) {
    const conditions: Filter<Report> = []
    if (params.caseId) {
      conditions.push({
        caseId: prefixRegexMatchFilter(params.caseId),
      })
    }
    if (params.filterReportId) {
      conditions.push({
        id: prefixRegexMatchFilter(params.filterReportId),
      })
    }
    if (params.filterCaseUserId) {
      conditions.push({
        caseUserId: prefixRegexMatchFilter(params.filterCaseUserId),
      })
    }
    if (params.filterJurisdiction) {
      conditions.push({
        reportTypeId: prefixRegexMatchFilter(params.filterJurisdiction),
      })
    }
    if (params.filterCreatedBy) {
      conditions.push({
        createdById: {
          $in: params.filterCreatedBy,
        },
      })
    }
    if (params.createdAtAfterTimestamp && params.createdAtBeforeTimestamp) {
      conditions.push({
        createdAt: {
          $gte: params.createdAtAfterTimestamp,
          $lte: params.createdAtBeforeTimestamp,
        },
      })
    }
    if (params.filterStatus) {
      conditions.push({
        status: {
          $in: params.filterStatus,
        },
      })
    }
    if (params.lastAckFetchTime) {
      conditions.push({
        $or: [
          { lastAckFetchTime: { $gte: params.lastAckFetchTime } },
          { lastAckFetchTime: { $exists: false } },
          { lastAckFetchTime: null },
        ],
      })
    }
    return conditions.length
      ? {
          $and: conditions,
        }
      : {}
  }

  public async getReportsByStatus(
    filterStatus: Array<ReportStatus>,
    filterJurisdiction?: CountryCode,
    lastAckFetchTime?: number
  ): Promise<Report[]> {
    const db = this.mongoDb.db()
    const collection = db.collection<Report>(REPORT_COLLECTION(this.tenantId))
    const filter = this.getConditionsFromParams({
      filterStatus,
      filterJurisdiction,
      lastAckFetchTime,
    })
    const pipeline: Document[] = [
      { $match: filter },
      { $sort: { createdAt: 1 } }, // TODO: only project caseId and status
    ]
    const reports = await collection
      .aggregate<Report>(pipeline, { allowDiskUse: true })
      .toArray()
    return reports
  }

  public async hasValidJurisdictionReports(
    filterStatus: Array<ReportStatus>,
    filterJurisdiction?: CountryCode,
    lastAckFetchTime?: number
  ) {
    const db = this.mongoDb.db()
    const collection = db.collection<Report>(REPORT_COLLECTION(this.tenantId))
    const filter = this.getConditionsFromParams({
      filterStatus,
      filterJurisdiction,
      lastAckFetchTime,
    })
    const pipeline: Document[] = [{ $match: filter }, { $limit: 1 }]
    const reports = await collection
      .aggregate<Report>(pipeline, { allowDiskUse: true })
      .toArray()

    return reports.length > 0
  }

  public async getReports(
    params: DefaultApiGetReportsRequest
  ): Promise<{ total: number; items: Report[] }> {
    const db = this.mongoDb.db()
    const collection = db.collection<Report>(REPORT_COLLECTION(this.tenantId))
    const filter = this.getConditionsFromParams(params)
    const pipeline: Document[] = [
      { $match: filter },
      { $sort: { createdAt: -1 } },
      ...paginatePipeline(params),
      {
        $lookup: {
          from: USERS_COLLECTION(this.tenantId), // The name of the users collection
          localField: 'caseUserId',
          foreignField: 'userId', // Assuming 'caseUserId' refers to the '_id' field in the 'users' collection
          as: 'caseUser', // Alias for the joined user document
        },
      },
      {
        $unwind: '$caseUser', // Convert 'user' array to a single document
      },
      { $unset: ['revisions', 'schema'] },
    ]
    const [total, reports] = await Promise.all([
      collection.count(filter as Filter<Report>),
      collection.aggregate<Report>(pipeline, { allowDiskUse: true }).toArray(),
    ])
    return {
      total,
      items: reports,
    }
  }

  public async deleteReports(reportIds: string[]) {
    const db = this.mongoDb.db()
    const collection = db.collection<Report>(REPORT_COLLECTION(this.tenantId))

    await sendMessageToMongoConsumer({
      documentKey: {
        type: 'filter',
        value: { id: { $in: reportIds } },
      },
      operationType: 'delete',
      clusterTime: Date.now(),
      collectionName: REPORT_COLLECTION(this.tenantId),
    })

    const reports = await collection
      .find({
        id: { $in: reportIds },
        status: 'DRAFT',
      })
      .toArray()

    const keys = reports.flatMap((report) => [
      ...(report.revisions?.map((rev) => rev.output) ?? []),
      ...(report.rawStatusInfo ? [report.rawStatusInfo] : []),
    ])

    await this.deleteS3Objects(keys)

    await collection.deleteMany({
      id: { $in: reportIds },
      status: 'DRAFT',
    })
  }

  private async deleteS3Objects(keys: string[]) {
    if (!keys.length) {
      return
    }

    const s3Client = new S3Client({
      region: process.env.AWS_REGION,
    })
    const bucket = process.env.DOCUMENT_BUCKET

    if (!bucket) {
      return
    }

    for (const batch of chunk(keys, 1000)) {
      const deleteParams: DeleteObjectsCommandInput = {
        Bucket: bucket,
        Delete: {
          Objects: compact(
            batch.map((key) => {
              const match = key.match(/^s3:document:(.+)$/)
              return match ? { Key: match[1] } : null
            })
          ),
          Quiet: true,
        },
      }
      await s3Client.send(new DeleteObjectsCommand(deleteParams))
    }
  }

  public async getLastGeneratedReport(
    schemaId: string
  ): Promise<Report | null> {
    const db = this.mongoDb.db()
    const collection = db.collection<Report>(REPORT_COLLECTION(this.tenantId))

    const report = await collection
      .find({
        reportTypeId: schemaId,
        status: 'COMPLETE',
        createdById: (getContext()?.user as Account)?.id,
      })
      .sort({ createdAt: -1 })
      .limit(1)
      .toArray()

    return report.length > 0 ? report[0] : null
  }

  public async updateReportStatus(
    reportId: string,
    status: ReportStatus,
    statusInfo = ''
  ): Promise<void> {
    const db = this.mongoDb.db()
    const collection = db.collection<Report>(REPORT_COLLECTION(this.tenantId))
    await collection.updateOne(
      { id: reportId },
      { $set: { status, statusInfo } }
    )
    await this.addOrUpdateSarItemsInDynamo(reportId, {
      reportId,
      status,
      region: '' as CountryCode, // As the id should be already present so we only update the status so region is not needed
    })
    await sendMessageToMongoConsumer({
      documentKey: { type: 'id', value: reportId },
      operationType: 'update',
      clusterTime: Date.now(),
      collectionName: REPORT_COLLECTION(this.tenantId),
    })
  }

  private async uploadReportRawStatusInfoToS3(key: string, xmlAck: string) {
    const { DOCUMENT_BUCKET } = process.env as {
      DOCUMENT_BUCKET: string
    }
    const parallelUploadS3 = new Upload({
      client: new S3Client({
        region: process.env.AWS_REGION,
      }),
      params: {
        Bucket: DOCUMENT_BUCKET,
        Key: key,
        Body: xmlAck,
      },
    })
    await parallelUploadS3.done()
  }

  public async updateReportAck(
    reportId: string,
    status: ReportStatus,
    xmlAck: string,
    parsedAck: string,
    lastAckFetchTime: number
  ): Promise<void> {
    const db = this.mongoDb.db()
    const collection = db.collection<Report>(REPORT_COLLECTION(this.tenantId))
    const report = await this.getReport(reportId)
    if (report?.rawStatusInfo) {
      await this.deleteS3Objects([report.rawStatusInfo])
    }
    const key = `${
      this.tenantId
    }/reports/${reportId}-rawStatusInfo-${Date.now()}.xml`
    await this.uploadReportRawStatusInfoToS3(key, xmlAck)
    await collection.updateOne(
      { id: reportId },
      {
        $set: {
          status,
          rawStatusInfo: `s3:document:${key}`,
          statusInfo: parsedAck,
          lastAckFetchTime,
        },
      }
    )
    await this.addOrUpdateSarItemsInDynamo(reportId, {
      reportId,
      status,
      region: '' as CountryCode, // As the id should be already present so we only update the status so region is not needed
    })
    await sendMessageToMongoConsumer({
      documentKey: { type: 'id', value: reportId },
      operationType: 'update',
      clusterTime: Date.now(),
      collectionName: REPORT_COLLECTION(this.tenantId),
    })
  }
}
