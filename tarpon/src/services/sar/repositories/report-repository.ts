import { Document, Filter, MongoClient, WithId } from 'mongodb'
import { omit } from 'lodash'
import { StackConstants } from '@lib/constants'
import {
  DynamoDBDocumentClient,
  GetCommand,
  GetCommandInput,
  UpdateCommand,
  UpdateCommandInput,
} from '@aws-sdk/lib-dynamodb'
import { Report } from '@/@types/openapi-internal/Report'
import { paginatePipeline, prefixRegexMatchFilter } from '@/utils/mongodb-utils'
import {
  REPORT_COLLECTION,
  USERS_COLLECTION,
} from '@/utils/mongodb-definitions'
import { DefaultApiGetReportsRequest } from '@/@types/openapi-internal/RequestParameters'
import { Account } from '@/@types/openapi-internal/Account'
import { getContext } from '@/core/utils/context'
import { traceable } from '@/core/xray'
import { ReportStatus } from '@/@types/openapi-internal/ReportStatus'
import { CounterRepository } from '@/services/counter/repository'
import { SarDetails } from '@/@types/openapi-internal/SarDetails'
import { DynamoDbKeys } from '@/core/dynamodb/dynamodb-keys'
import { CountryCode } from '@/@types/openapi-public/CountryCode'

@traceable
export class ReportRepository {
  tenantId: string
  mongoDb: MongoClient
  dynamoDb?: DynamoDBDocumentClient

  constructor(
    tenantId: string,
    mongoDb: MongoClient,
    dynamoDb?: DynamoDBDocumentClient
  ) {
    this.tenantId = tenantId
    this.mongoDb = mongoDb
    this.dynamoDb = dynamoDb
  }

  public async getId(): Promise<string> {
    const counterRepository = new CounterRepository(this.tenantId, this.mongoDb)
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

    await this.addOrUpdateSarItemsInDynamo(newReport.caseUserId, {
      reportId: newReport.id ?? '',
      status: newReport.status,
      region: newReport.reportTypeId.split('-')[0] as CountryCode,
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
    return conditions.length
      ? {
          $and: conditions,
        }
      : {}
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
  }
}
