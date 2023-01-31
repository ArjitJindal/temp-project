import { MongoClient } from 'mongodb'
import { v4 as uuidv4 } from 'uuid'
import _ from 'lodash'
import {
  SIMULATION_TASK_COLLECTION,
  paginateFindOptions,
} from '@/utils/mongoDBUtils'
import { SimulationPulseParameters } from '@/@types/openapi-internal/SimulationPulseParameters'
import { SimulationPulseTask } from '@/@types/openapi-internal/SimulationPulseTask'
import {
  TaskStatusChange,
  TaskStatusChangeStatusEnum,
} from '@/@types/openapi-internal/TaskStatusChange'
import { DefaultApiGetSimulationsRequest } from '@/@types/openapi-internal/RequestParameters'
import { SimulationPulseStatisticsResult } from '@/@types/openapi-internal/SimulationPulseStatisticsResult'

export class SimulationTaskRepository {
  tenantId: string
  mongoDb: MongoClient

  constructor(tenantId: string, mongoDb: MongoClient) {
    this.tenantId = tenantId
    this.mongoDb = mongoDb
  }

  public async createSimulationTask(
    parameters: SimulationPulseParameters
  ): Promise<string> {
    const db = this.mongoDb.db()
    const collection = db.collection<SimulationPulseTask>(
      SIMULATION_TASK_COLLECTION(this.tenantId)
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
    statistics: SimulationPulseStatisticsResult
  ) {
    const db = this.mongoDb.db()
    const collection = db.collection<SimulationPulseTask>(
      SIMULATION_TASK_COLLECTION(this.tenantId)
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
    const collection = db.collection<SimulationPulseTask>(
      SIMULATION_TASK_COLLECTION(this.tenantId)
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

  public async getSimulationTask(
    taskId: string
  ): Promise<SimulationPulseTask | null> {
    const db = this.mongoDb.db()
    const collection = db.collection<SimulationPulseTask>(
      SIMULATION_TASK_COLLECTION(this.tenantId)
    )
    const task = await collection.findOne({ _id: taskId as any })
    return task ? _.omit(task, '_id') : null
  }

  public async getSimulationTasks(
    params: DefaultApiGetSimulationsRequest
  ): Promise<{ total: number; data: SimulationPulseTask[] }> {
    const db = this.mongoDb.db()
    const collection = db.collection<SimulationPulseTask>(
      SIMULATION_TASK_COLLECTION(this.tenantId)
    )
    const query = { type: params.type }
    const simulationTasks = await collection
      .find(query, {
        sort: { createdAt: -1 },
        ...paginateFindOptions(params),
      })
      .toArray()
    const total = await collection.countDocuments(query)

    return {
      total,
      data: simulationTasks.map((task) => _.omit(task, '_id')),
    }
  }
}
