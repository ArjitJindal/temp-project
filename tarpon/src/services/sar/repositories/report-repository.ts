import { Document, MongoClient, WithId } from 'mongodb'
import _ from 'lodash'
import { Report } from '@/@types/openapi-internal/Report'
import {
  COUNTER_COLLECTION,
  paginatePipeline,
  REPORT_COLLECTION,
} from '@/utils/mongoDBUtils'
import { DefaultApiGetReportsRequest } from '@/@types/openapi-internal/RequestParameters'
import { EntityCounter } from '@/@types/openapi-internal/EntityCounter'
import { Account } from '@/@types/openapi-internal/Account'
import { getContext } from '@/core/utils/context'

export class ReportRepository {
  tenantId: string
  mongoDb: MongoClient

  constructor(tenantId: string, mongoDb: MongoClient) {
    this.tenantId = tenantId
    this.mongoDb = mongoDb
  }

  public async getId(): Promise<string> {
    const db = this.mongoDb.db()
    const counterCollection = db.collection<EntityCounter>(
      COUNTER_COLLECTION(this.tenantId)
    )
    const reportCount = (
      await counterCollection.findOneAndUpdate(
        { entity: 'Report' },
        { $inc: { count: 1 } },
        { upsert: true, returnDocument: 'after' }
      )
    ).value
    return `RP-${reportCount?.count}`
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
      if (existingReport.status === 'draft') {
        if (reportPayload.status === existingReport.status) {
          newReport = {
            ...existingReport,
            ...reportPayload,
          }
        } else {
          newReport = {
            ...existingReport,
            ...reportPayload,
            status: 'complete',
          }
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
        id: await this.getId(),
      }
    }

    await collection.replaceOne(
      {
        _id: newReport.id as any,
      },
      _.omit(newReport, '_id'),
      {
        upsert: true,
      }
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
  ): Promise<{ total: number; items: Report[] }> {
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
        schemaId,
        status: 'complete',
        createdById: (getContext()?.user as Account)?.id,
      })
      .sort({ createdAt: -1 })
      .limit(1)
      .toArray()

    return report.length > 0 ? report[0] : null
  }
}
