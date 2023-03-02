import { MongoClient } from 'mongodb'
import { v4 as uuidv4 } from 'uuid'
import _ from 'lodash'
import {
  SIMULATION_TASK_COLLECTION,
  paginateFindOptions,
} from '@/utils/mongoDBUtils'
import { SimulationPulseJob } from '@/@types/openapi-internal/SimulationPulseJob'
import {
  TaskStatusChange,
  TaskStatusChangeStatusEnum,
} from '@/@types/openapi-internal/TaskStatusChange'
import { DefaultApiGetSimulationsRequest } from '@/@types/openapi-internal/RequestParameters'
import { SimulationPulseStatisticsResult } from '@/@types/openapi-internal/SimulationPulseStatisticsResult'
import { SimulationPulseParametersRequest } from '@/@types/openapi-internal/SimulationPulseParametersRequest'
import { SimulationPulseIteration } from '@/@types/openapi-internal/SimulationPulseIteration'
import { getContext } from '@/core/utils/context'
import { Account } from '@/@types/openapi-internal/Account'

export class SimulationTaskRepository {
  tenantId: string
  mongoDb: MongoClient

  constructor(tenantId: string, mongoDb: MongoClient) {
    this.tenantId = tenantId
    this.mongoDb = mongoDb
  }

  private generateIterationsObject(
    simulationRequest: SimulationPulseParametersRequest,
    taskIds: string[]
  ): Array<SimulationPulseIteration> {
    const now = Date.now()
    const status: TaskStatusChange = {
      status: 'PENDING',
      timestamp: now,
    }

    return simulationRequest.parameters.map((parameter) => {
      const taskId = uuidv4()
      taskIds.push(taskId)

      return {
        taskId,
        parameters: parameter,
        progress: 0,
        statistics: { current: [], simulated: [] },
        latestStatus: status,
        statuses: [status],
        name: parameter.name,
        description: parameter.description,
        type: parameter.type,
        createdAt: now,
        createdBy:
          process.env.NODE_ENV === 'test'
            ? 'test'
            : (getContext()?.user as Account)?.id,
      }
    })
  }

  public async createSimulationJob(
    simulationRequest: SimulationPulseParametersRequest
  ): Promise<{ jobId: string; taskIds: Array<string> }> {
    const db = this.mongoDb.db()
    const collection = db.collection<SimulationPulseJob>(
      SIMULATION_TASK_COLLECTION(this.tenantId)
    )
    const taskIds: string[] = []
    const now = Date.now()
    const jobId = simulationRequest.jobId ?? uuidv4()

    if (simulationRequest.jobId) {
      const existsingJob = await collection.findOne({
        _id: simulationRequest.jobId as any,
      })
      existsingJob?.iterations?.concat(
        this.generateIterationsObject(simulationRequest, taskIds)
      )
      await collection.updateOne(
        { _id: simulationRequest.jobId as any },
        {
          $set: {
            iterations: existsingJob?.iterations,
          },
        }
      )
    } else {
      await collection.insertOne({
        _id: jobId as any,
        createdAt: now,
        jobId,
        type: simulationRequest.type,
        iterations: this.generateIterationsObject(simulationRequest, taskIds),
        defaultRiskClassifications:
          simulationRequest.defaultRiskClassifications,
        createdBy:
          process.env.NODE_ENV === 'test'
            ? 'test'
            : (getContext()?.user as Account)?.id,
      })
    }

    return { jobId, taskIds }
  }

  public async updateStatistics(
    taskId: string,
    statistics: SimulationPulseStatisticsResult
  ) {
    const db = this.mongoDb.db()
    const collection = db.collection<SimulationPulseJob>(
      SIMULATION_TASK_COLLECTION(this.tenantId)
    )

    const job = await collection.findOne({ 'iterations.taskId': taskId })
    const updatedIteration = job?.iterations?.map((iteration) => {
      if (iteration.taskId === taskId) {
        return { ...iteration, statistics }
      }
      return iteration
    })

    if (job?.jobId) {
      await collection.updateOne(
        { _id: job.jobId as any },
        { $set: { iterations: updatedIteration ?? [] } }
      )
    }
  }

  public async updateTaskStatus(
    taskId: string,
    status: TaskStatusChangeStatusEnum,
    progress?: number
  ) {
    const db = this.mongoDb.db()
    const collection = db.collection<SimulationPulseJob>(
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

    const job = await collection.findOne({ 'iterations.taskId': taskId })
    const updatedIteration = job?.iterations?.map((iteration) => {
      if (iteration.taskId === taskId) {
        return {
          ...iteration,
          latestStatus: newStatus,
          statuses: [...iteration.statuses, newStatus],
          ...(progressToSave ? { progress: progressToSave } : undefined),
        }
      }
      return iteration
    })

    if (job?.jobId) {
      await collection.updateOne(
        { _id: job.jobId as any },
        { $set: { iterations: updatedIteration ?? [] } }
      )
    }
  }

  public async getSimulationJob(
    jobId: string
  ): Promise<SimulationPulseJob | null> {
    const db = this.mongoDb.db()
    const collection = db.collection<SimulationPulseJob>(
      SIMULATION_TASK_COLLECTION(this.tenantId)
    )
    const task = await collection.findOne({ _id: jobId as any })
    return task ? _.omit(task, '_id') : null
  }

  public async getSimulationJobs(
    params: DefaultApiGetSimulationsRequest
  ): Promise<{ total: number; data: SimulationPulseJob[] }> {
    const db = this.mongoDb.db()
    const collection = db.collection<SimulationPulseJob>(
      SIMULATION_TASK_COLLECTION(this.tenantId)
    )
    const query = { type: params.type }
    const simulationTasks = await collection
      .find(query, {
        sort: {
          [params?.sortField ?? 'createdAt']:
            params?.sortOrder === 'ascend' ? 1 : -1,
        },
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
