import { MongoClient, Document } from 'mongodb'
import { v4 as uuidv4 } from 'uuid'
import _ from 'lodash'
import { Report } from '@/@types/openapi-internal/Report'
import { REPORT_COLLECTION, paginatePipeline } from '@/utils/mongoDBUtils'
import { DefaultApiGetReportsRequest } from '@/@types/openapi-internal/RequestParameters'

export class ReportRepository {
  tenantId: string
  mongoDb: MongoClient

  constructor(tenantId: string, mongoDb: MongoClient) {
    this.tenantId = tenantId
    this.mongoDb = mongoDb
  }

  public async saveOrUpdateReport(report: Report): Promise<Report> {
    const db = this.mongoDb.db()
    const collection = db.collection<Report>(REPORT_COLLECTION(this.tenantId))
    const reportId = report.id ?? uuidv4()
    const newReport: Report = {
      ...report,
      id: reportId,
    }
    await collection.replaceOne(
      {
        _id: reportId as any,
      },
      newReport,
      { upsert: true }
    )
    return newReport
  }

  public async getReport(reportId: string): Promise<Report | null> {
    const db = this.mongoDb.db()
    const collection = db.collection<Report>(REPORT_COLLECTION(this.tenantId))
    const report = await collection.findOne({ _id: reportId as any })
    return report ? _.omit(report, '_id') : null
  }

  public async getReports(
    params: DefaultApiGetReportsRequest
  ): Promise<{ total: number; data: Report[] }> {
    const db = this.mongoDb.db()
    const collection = db.collection<Report>(REPORT_COLLECTION(this.tenantId))
    const filter = _.omitBy(
      {
        caseId: params.caseId,
      },
      _.isUndefined
    )
    const pipeline: Document[] = [
      { $match: filter },
      { $sort: { createdAt: 1 } },
      ...paginatePipeline(params),
    ]
    const [total, reports] = await Promise.all([
      collection.count(filter),
      collection.aggregate<Report>(pipeline).toArray(),
    ])
    return {
      total,
      data: reports,
    }
  }
}
