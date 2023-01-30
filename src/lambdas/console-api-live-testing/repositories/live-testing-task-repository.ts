import { MongoClient } from 'mongodb'
import { v4 as uuidv4 } from 'uuid'
import _ from 'lodash'
import {
  LIVE_TESTING_TASK_COLLECTION,
  paginateFindOptions,
} from '@/utils/mongoDBUtils'
import { LiveTestPulseParameters } from '@/@types/openapi-internal/LiveTestPulseParameters'
import { LiveTestPulseTask } from '@/@types/openapi-internal/LiveTestPulseTask'
import {
  TaskStatusChange,
  TaskStatusChangeStatusEnum,
} from '@/@types/openapi-internal/TaskStatusChange'
import { DefaultApiGetLiveTestingRequest } from '@/@types/openapi-internal/RequestParameters'
import { LiveTestPulseStatisticsResult } from '@/@types/openapi-internal/LiveTestPulseStatisticsResult'

export class LiveTestingTaskRepository {
  tenantId: string
  mongoDb: MongoClient

  constructor(tenantId: string, mongoDb: MongoClient) {
    this.tenantId = tenantId
    this.mongoDb = mongoDb
  }

  public async createLiveTestingTask(
    parameters: LiveTestPulseParameters
  ): Promise<string> {
    const db = this.mongoDb.db()
    const collection = db.collection<LiveTestPulseTask>(
      LIVE_TESTING_TASK_COLLECTION(this.tenantId)
    )
    const taskId = uuidv4()
    const now = Date.now()
    const status: TaskStatusChange = {
      status: 'PENDING',
      timestamp: now,
    }
    await collection.insertOne({
      _id: taskId as any,
      createdAt: now,
      taskId,
      type: parameters.type,
      parameters,
      progress: 0,
      statistics: { current: [], simulated: [] },
      latestStatus: status,
      statuses: [status],
    })
    return taskId
  }

  public async updateStatistics(
    taskId: string,
    statistics: LiveTestPulseStatisticsResult
  ) {
    const db = this.mongoDb.db()
    const collection = db.collection<LiveTestPulseTask>(
      LIVE_TESTING_TASK_COLLECTION(this.tenantId)
    )
    await collection.updateOne(
      { _id: taskId as any },
      {
        $set: {
          statistics,
        },
      }
    )
  }

  public async updateTaskStatus(
    taskId: string,
    status: TaskStatusChangeStatusEnum,
    progress?: number
  ) {
    const db = this.mongoDb.db()
    const collection = db.collection<LiveTestPulseTask>(
      LIVE_TESTING_TASK_COLLECTION(this.tenantId)
    )
    const newStatus: TaskStatusChange = {
      status,
      timestamp: Date.now(),
    }
    const progressToSave = progress
      ? progress
      : status === 'SUCCESS'
      ? 1
      : undefined
    await collection.updateOne(
      { _id: taskId as any },
      {
        $set: {
          latestStatus: newStatus,
          ...(progressToSave
            ? {
                progress: progressToSave,
              }
            : undefined),
        },
        $push: { statuses: newStatus },
      }
    )
  }

  public async getLiveTestingTask(
    taskId: string
  ): Promise<LiveTestPulseTask | null> {
    const db = this.mongoDb.db()
    const collection = db.collection<LiveTestPulseTask>(
      LIVE_TESTING_TASK_COLLECTION(this.tenantId)
    )
    const task = await collection.findOne({ _id: taskId as any })
    return task ? _.omit(task, '_id') : null
  }

  public async getLiveTestingTasks(
    params: DefaultApiGetLiveTestingRequest
  ): Promise<{ total: number; data: LiveTestPulseTask[] }> {
    const db = this.mongoDb.db()
    const collection = db.collection<LiveTestPulseTask>(
      LIVE_TESTING_TASK_COLLECTION(this.tenantId)
    )
    const query = { type: params.type }
    const liveTestingTasks = await collection
      .find(query, {
        sort: { createdAt: -1 },
        ...paginateFindOptions(params),
      })
      .toArray()
    const total = await collection.countDocuments(query)

    return {
      total,
      data: liveTestingTasks.map((task) => _.omit(task, '_id')),
    }
  }
}
