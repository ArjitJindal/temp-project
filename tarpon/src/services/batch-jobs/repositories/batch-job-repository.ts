import { Filter, MongoClient, UpdateFilter } from 'mongodb'
import { omit } from 'lodash'
import { BatchJobInDb, BatchJobType, BatchJobWithId } from '@/@types/batch-job'
import { traceable } from '@/core/xray'
import { JOBS_COLLECTION } from '@/utils/mongodb-definitions'
import {
  TaskStatusChange,
  TaskStatusChangeStatusEnum,
} from '@/@types/openapi-internal/TaskStatusChange'

@traceable
export class BatchJobRepository {
  tenantId: string
  mongoDb: MongoClient

  constructor(tenantId: string, mongoDb: MongoClient) {
    this.tenantId = tenantId
    this.mongoDb = mongoDb
  }

  public async getJobById(jobId: string): Promise<BatchJobInDb | null> {
    const collection = JOBS_COLLECTION(this.tenantId)
    const db = this.mongoDb.db()
    return db.collection<BatchJobInDb>(collection).findOne({ jobId })
  }

  public async getJobsByStatus(
    latestStatuses: TaskStatusChangeStatusEnum[],
    params?: {
      filterTypes?: BatchJobType[]
      filterParameters?: any
    }
  ): Promise<BatchJobInDb[]> {
    const collection = JOBS_COLLECTION(this.tenantId)
    const db = this.mongoDb.db()
    return db
      .collection<BatchJobInDb>(collection)
      .find({
        $and: [
          { 'latestStatus.status': { $in: latestStatuses } },
          ...(params?.filterTypes
            ? [{ type: { $in: params.filterTypes } }]
            : []),
          ...(params?.filterParameters
            ? [{ parameters: params.filterParameters }]
            : []),
        ],
      })
      .toArray()
  }

  public async insertJob(
    job: BatchJobWithId,
    scheduledAt?: number
  ): Promise<void> {
    const collection = JOBS_COLLECTION(this.tenantId)
    const db = this.mongoDb.db()
    const latestStatus: TaskStatusChange = {
      status: 'PENDING',
      timestamp: Date.now(),
      scheduledAt: scheduledAt,
    }
    await db.collection(collection).insertOne({
      ...omit(job, '_id'),
      latestStatus,
      statuses: [latestStatus],
    })
  }

  public async updateJobStatus(
    jobId: string,
    status: TaskStatusChangeStatusEnum
  ): Promise<void> {
    const collection = JOBS_COLLECTION(this.tenantId)
    const db = this.mongoDb.db()
    const latestStatus: TaskStatusChange = {
      status,
      timestamp: Date.now(),
    }
    await db.collection(collection).updateOne(
      { jobId },
      {
        $set: {
          latestStatus,
        },
        $push: {
          statuses: latestStatus,
        },
      }
    )
  }

  public async updateJob(
    jobId: string,
    updater: UpdateFilter<BatchJobInDb>
  ): Promise<BatchJobInDb> {
    const collection = JOBS_COLLECTION(this.tenantId)
    const db = this.mongoDb.db()
    const result = await db
      .collection<BatchJobInDb>(collection)
      .findOneAndUpdate({ jobId }, updater, { returnDocument: 'after' })
    return result.value as BatchJobInDb
  }

  public async getJobs(
    filters: Filter<BatchJobInDb>,
    limit: number = 20
  ): Promise<BatchJobInDb[]> {
    const collection = JOBS_COLLECTION(this.tenantId)
    const db = this.mongoDb.db()
    return db
      .collection<BatchJobInDb>(collection)
      .find(filters)
      .sort({ 'latestStatus.timestamp': -1 })
      .limit(limit)
      .toArray()
  }
}
