import { Collection, Filter, MongoClient, WithId } from 'mongodb'
import { omit } from 'lodash'
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb'
import { DynamoBatchJobRepository } from './dynamo-repository'
import { BatchJobFilterUtils } from './filter-utils'
import { BatchJobClickhouseRepository } from './clickhouse-repository'
import {
  BatchJobInDb,
  BatchJobParameters,
  BatchJobParams,
  BatchJobType,
  BatchJobWithId,
  RulePreAggregationMetadata,
} from '@/@types/batch-job'
import { traceable } from '@/core/xray'
import { JOBS_COLLECTION } from '@/utils/mongodb-definitions'
import { TaskStatusChange } from '@/@types/openapi-internal/TaskStatusChange'
import { TaskStatusChangeStatusEnum } from '@/@types/openapi-internal/TaskStatusChangeStatusEnum'
import {
  isClickhouseEnabledInRegion,
  isClickhouseMigrationEnabled,
} from '@/utils/clickhouse/utils'
import { getDynamoDbClient } from '@/utils/dynamodb'

@traceable
export class BatchJobRepository {
  tenantId: string
  mongoDb: MongoClient
  dynamoDb: DynamoDBDocumentClient
  dynamoBatchJobRepository: DynamoBatchJobRepository
  batchJobClickhouseRepository: BatchJobClickhouseRepository
  collection: Collection<BatchJobInDb>

  constructor(tenantId: string, mongoDb: MongoClient) {
    this.tenantId = tenantId
    this.mongoDb = mongoDb
    this.dynamoDb = getDynamoDbClient()
    this.dynamoBatchJobRepository = new DynamoBatchJobRepository(
      tenantId,
      this.dynamoDb
    )
    const db = this.mongoDb.db()
    this.collection = db.collection<BatchJobInDb>(JOBS_COLLECTION(tenantId))
    this.batchJobClickhouseRepository = new BatchJobClickhouseRepository(
      tenantId
    )
  }

  public async getJobById(jobId: string): Promise<BatchJobInDb | null> {
    if (isClickhouseMigrationEnabled()) {
      return await this.batchJobClickhouseRepository.getJobById(jobId)
    }
    const collection = JOBS_COLLECTION(this.tenantId)
    const db = this.mongoDb.db()
    return db.collection<BatchJobInDb>(collection).findOne({ jobId })
  }

  public async getJobsByStatus(
    latestStatuses: TaskStatusChangeStatusEnum[],
    params?: {
      filterTypes?: BatchJobType[]
    }
  ): Promise<BatchJobInDb[]> {
    if (isClickhouseMigrationEnabled()) {
      return await this.batchJobClickhouseRepository.getJobsByStatus({
        latestStatuses,
        filterTypes: params?.filterTypes,
      })
    }
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
    const batchJobToInsert = {
      ...omit(job, '_id'),
      latestStatus,
      statuses: [latestStatus],
    } as BatchJobInDb
    if (isClickhouseEnabledInRegion()) {
      await this.dynamoBatchJobRepository.saveJobs([
        batchJobToInsert as BatchJobInDb,
      ])
    }
    await db.collection(collection).insertOne(batchJobToInsert)
  }

  public async updateJobStatus(
    jobId: string,
    status: TaskStatusChangeStatusEnum
  ): Promise<void> {
    const latestStatus: TaskStatusChange = {
      status,
      timestamp: Date.now(),
    }
    if (isClickhouseEnabledInRegion()) {
      await this.dynamoBatchJobRepository.updateJobStatus(jobId, latestStatus)
    }
    await this.collection.updateOne(
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

  public async isAnyJobRunning(
    type: BatchJobType,
    subFilter?: Filter<WithId<BatchJobInDb>>
  ): Promise<boolean> {
    if (isClickhouseMigrationEnabled()) {
      return await this.dynamoBatchJobRepository.isAnyJobRunning(type)
    }
    const collection = JOBS_COLLECTION(this.tenantId)
    const db = this.mongoDb.db()
    const filters = {
      type,
      'latestStatus.status': { $in: ['PENDING', 'IN_PROGRESS'] },
      ...(subFilter ? subFilter : {}),
    }
    const result = await db
      .collection<BatchJobInDb>(collection)
      .findOne(filters)

    return result !== null
  }

  public async incrementCompleteTasksCount(
    jobId: string
  ): Promise<BatchJobInDb> {
    if (isClickhouseEnabledInRegion()) {
      await this.dynamoBatchJobRepository.incrementCompleteTasksCount(jobId)
    }
    const result = await this.collection.findOneAndUpdate(
      { jobId },
      { $inc: { 'metadata.completeTasksCount': 1 } },
      { returnDocument: 'after' }
    )

    return result.value as BatchJobInDb
  }

  public async getJobsCount(
    type: BatchJobType,
    subFilter?: Filter<WithId<BatchJobInDb>>
  ): Promise<number> {
    const collection = JOBS_COLLECTION(this.tenantId)
    const db = this.mongoDb.db()

    const result = await db
      .collection<BatchJobInDb>(collection)
      .countDocuments({
        type,
        ...(subFilter ? subFilter : {}),
      })
    return result
  }

  public async setMetadata(
    jobId: string,
    metadata: RulePreAggregationMetadata
  ): Promise<BatchJobInDb> {
    if (isClickhouseEnabledInRegion()) {
      await this.dynamoBatchJobRepository.setMetadata(jobId, metadata)
    }
    const result = await this.collection.findOneAndUpdate(
      { jobId },
      { $set: { metadata } },
      { returnDocument: 'after' }
    )

    return result.value as BatchJobInDb
  }

  public async incrementMetadataTasksCount(
    jobId: string,
    tasksCount: number
  ): Promise<BatchJobInDb> {
    if (isClickhouseEnabledInRegion()) {
      await this.dynamoBatchJobRepository.incrementMetadataTasksCount(
        jobId,
        tasksCount
      )
    }
    const result = await this.collection.findOneAndUpdate(
      { jobId },
      { $inc: { 'metadata.tasksCount': tasksCount } },
      { returnDocument: 'after' }
    )

    return result.value as BatchJobInDb
  }

  public async updateJobScheduleAndParameters(
    jobId: string,
    addScheduledAt: number,
    parameters?: BatchJobParameters
  ): Promise<BatchJobInDb> {
    if (isClickhouseEnabledInRegion()) {
      await this.dynamoBatchJobRepository.updateJobScheduleAndParameters(
        jobId,
        addScheduledAt,
        parameters
      )
    }
    const result = await this.collection.findOneAndUpdate(
      { jobId },
      [
        {
          $set: {
            'latestStatus.scheduledAt': {
              $add: ['$latestStatus.scheduledAt', addScheduledAt],
            },
            ...(parameters?.ruleInstancesIds && {
              'parameters.ruleInstancesIds': parameters.ruleInstancesIds,
            }),
            ...(parameters?.userIds && {
              'parameters.userIds': {
                $setUnion: ['$parameters.userIds', parameters.userIds],
              },
            }),
            ...(parameters?.clearedListIds && {
              'parameters.clearedListIds': {
                $setUnion: [
                  '$parameters.clearedListIds',
                  [parameters.clearedListIds],
                ],
              },
            }),
          },
        },
      ],
      { returnDocument: 'after' }
    )

    return result.value as BatchJobInDb
  }

  private getMongoFilters(filters: BatchJobParams) {
    return new BatchJobFilterUtils().buildMongoFilters(filters).mongoFilters
  }

  public async getJobs(
    filters: BatchJobParams,
    limit: number = 20
  ): Promise<BatchJobInDb[]> {
    if (isClickhouseMigrationEnabled()) {
      return await this.batchJobClickhouseRepository.getJobs(filters, limit)
    }
    const collection = JOBS_COLLECTION(this.tenantId)
    const mongoFilters = this.getMongoFilters(filters)
    const db = this.mongoDb.db()
    const result = await db
      .collection<BatchJobInDb>(collection)
      .find(mongoFilters)
      .sort({ 'latestStatus.timestamp': -1 })
      .limit(limit)
      .toArray()
    return result
  }

  public async getLatestJob(
    filters: Filter<WithId<BatchJobInDb>>
  ): Promise<BatchJobInDb | null> {
    const collection = JOBS_COLLECTION(this.tenantId)
    const db = this.mongoDb.db()
    const result = await db
      .collection<BatchJobInDb>(collection)
      .findOne(filters, { sort: { 'latestStatus.timestamp': -1 } })
    return result
  }
}
