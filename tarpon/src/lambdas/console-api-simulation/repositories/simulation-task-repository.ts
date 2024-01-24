import { Filter, MongoClient } from 'mongodb'
import { v4 as uuidv4 } from 'uuid'

import { omit, random } from 'lodash'
import { demoRuleSimulation } from '../utils/demo-rule-simulation'
import { paginatePipeline } from '@/utils/mongodb-utils'
import { SIMULATION_TASK_COLLECTION } from '@/utils/mongodb-definitions'
import { SimulationPulseJob } from '@/@types/openapi-internal/SimulationPulseJob'
import {
  TaskStatusChange,
  TaskStatusChangeStatusEnum,
} from '@/@types/openapi-internal/TaskStatusChange'
import { DefaultApiGetSimulationsRequest } from '@/@types/openapi-internal/RequestParameters'
import { SimulationPulseStatisticsResult } from '@/@types/openapi-internal/SimulationPulseStatisticsResult'
import { SimulationBeaconStatisticsResult } from '@/@types/openapi-internal/SimulationBeaconStatisticsResult'
import { SimulationPulseParametersRequest } from '@/@types/openapi-internal/SimulationPulseParametersRequest'
import { SimulationPulseIteration } from '@/@types/openapi-internal/SimulationPulseIteration'
import { getContext } from '@/core/utils/context'
import { Account } from '@/@types/openapi-internal/Account'
import { SimulationGetResponse } from '@/@types/openapi-internal/SimulationGetResponse'
import { SimulationPostResponse } from '@/@types/openapi-internal/SimulationPostResponse'
import { SimulationBeaconJob } from '@/@types/openapi-internal/SimulationBeaconJob'
import { SimulationBeaconParametersRequest } from '@/@types/openapi-internal/SimulationBeaconParametersRequest'
import { SimulationBeaconIteration } from '@/@types/openapi-internal/SimulationBeaconIteration'
import { SimulationJob } from '@/@types/openapi-internal/SimulationJob'
import { isCurrentUserAtLeastRole } from '@/@types/jwt'
import { traceable } from '@/core/xray'
import { isDemoTenant } from '@/utils/tenant'
import { TXN_COUNT } from '@/core/seed/data/transactions'

@traceable
export class SimulationTaskRepository {
  tenantId: string
  mongoDb: MongoClient

  constructor(tenantId: string, mongoDb: MongoClient) {
    this.tenantId = tenantId
    this.mongoDb = mongoDb
  }

  private generateIterationsObject(
    simulationRequest:
      | SimulationPulseParametersRequest
      | SimulationBeaconParametersRequest,
    taskIds: string[]
  ): Array<SimulationPulseIteration> | Array<SimulationBeaconIteration> {
    const now = Date.now()
    const status: TaskStatusChange = {
      status: 'PENDING',
      timestamp: now,
    }

    const result = simulationRequest.parameters.map((parameter) => {
      const taskId = uuidv4()
      taskIds.push(taskId)

      let statistics:
        | SimulationPulseStatisticsResult
        | SimulationBeaconStatisticsResult
        | undefined = undefined

      if (simulationRequest.type === 'PULSE') {
        statistics = {
          current: [],
          simulated: [],
        }
      } else if (simulationRequest.type === 'BEACON') {
        statistics = {
          current: {},
          simulated: {},
        }
      }

      return {
        taskId,
        parameters: parameter,
        progress: 0,
        statistics,
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

    return simulationRequest.type === 'PULSE'
      ? (result as SimulationPulseIteration[])
      : (result as SimulationBeaconIteration[])
  }

  public async createSimulationJob(
    simulationRequest:
      | SimulationPulseParametersRequest
      | SimulationBeaconParametersRequest
  ): Promise<SimulationPostResponse> {
    const db = this.mongoDb.db()
    const collection = db.collection<SimulationPulseJob | SimulationBeaconJob>(
      SIMULATION_TASK_COLLECTION(this.tenantId)
    )
    const taskIds: string[] = []
    const now = Date.now()
    const jobId = simulationRequest.jobId ?? uuidv4()

    if (simulationRequest.jobId) {
      const existsingJob = await collection.findOne({
        _id: simulationRequest.jobId as any,
      })
      const newIterations =
        simulationRequest.type === 'PULSE'
          ? (existsingJob?.iterations as SimulationPulseIteration[]).concat(
              this.generateIterationsObject(
                simulationRequest,
                taskIds
              ) as SimulationPulseIteration[]
            )
          : (existsingJob?.iterations as SimulationBeaconIteration[]).concat(
              this.generateIterationsObject(
                simulationRequest,
                taskIds
              ) as SimulationBeaconIteration[]
            )

      await collection.updateOne(
        { _id: simulationRequest.jobId as any },
        {
          $set: {
            iterations: newIterations as SimulationPulseIteration[],
          },
        }
      )
    } else {
      const createdByUser = getContext()?.user as Account
      const baseJob: SimulationJob = {
        createdAt: now,
        jobId,
        createdBy: process.env.NODE_ENV === 'test' ? 'test' : createdByUser?.id,
        internal: isCurrentUserAtLeastRole('root'),
      }
      let job: SimulationPulseJob | SimulationBeaconJob | null = null
      if (simulationRequest.type === 'PULSE') {
        job = {
          ...baseJob,
          type: 'PULSE',
          defaultRiskClassifications:
            simulationRequest.defaultRiskClassifications,
          iterations: this.generateIterationsObject(
            simulationRequest,
            taskIds
          ) as SimulationPulseIteration[],
        } as SimulationPulseJob
      } else {
        job = {
          ...baseJob,
          type: 'BEACON',
          defaultRuleInstance: simulationRequest.defaultRuleInstance,
          iterations: this.generateIterationsObject(
            simulationRequest,
            taskIds
          ) as SimulationBeaconIteration[],
        } as SimulationBeaconJob
      }

      if (isDemoTenant(this.tenantId) && simulationRequest.type === 'BEACON') {
        const demoJob = demoRuleSimulation

        demoJob.jobId = jobId
        demoJob.createdAt = now
        demoJob.createdBy = createdByUser?.id
        demoJob.internal = isCurrentUserAtLeastRole('root')

        demoJob.defaultRuleInstance = simulationRequest.defaultRuleInstance

        demoJob.iterations = demoJob.iterations.map((iteration, index) => {
          return {
            ...iteration,
            type: 'BEACON',
            parameters: {
              ruleInstance: simulationRequest.parameters[index].ruleInstance,
              sampling: {
                transactionsCount: TXN_COUNT,
              },
              name: simulationRequest.parameters[index].name,
              description: simulationRequest.parameters[index].description,
              type: simulationRequest.parameters[index].type,
            },
            statistics: {
              current: {
                falsePositivesCases: random(20, 40),
                totalCases: random(250, 300),
                transactionsHit: random(2500, 3000),
                usersHit: random(250, 300),
              },
              simulated: {
                falsePositivesCases: random(20, 40),
                totalCases: random(250, 300),
                transactionsHit: random(2500, 3000),
                usersHit: random(250, 300),
              },
            },
          } as SimulationBeaconIteration
        })
        await collection.insertOne({
          _id: demoJob.jobId as any,
          ...demoJob,
        })

        return { jobId: demoJob.jobId, taskIds }
      }

      await collection.insertOne({
        _id: job.jobId as any,
        ...job,
      })
    }

    return { jobId, taskIds }
  }

  public async updateStatistics(
    taskId: string,
    statistics:
      | SimulationPulseStatisticsResult
      | SimulationBeaconStatisticsResult
  ) {
    const db = this.mongoDb.db()
    const collection = db.collection<SimulationPulseJob | SimulationBeaconJob>(
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
        {
          $set: {
            iterations: (updatedIteration as SimulationPulseIteration[]) ?? [],
          },
        }
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
    return omit(task, '_id')
  }

  public async getSimulationJobs(
    params: DefaultApiGetSimulationsRequest
  ): Promise<SimulationGetResponse> {
    const db = this.mongoDb.db()
    const collection = db.collection<SimulationPulseJob | SimulationBeaconJob>(
      SIMULATION_TASK_COLLECTION(this.tenantId)
    )
    const query: Filter<Partial<SimulationPulseJob | SimulationBeaconJob>> = {
      type: params.type,
    }
    if (!params.includeInternal) {
      query.internal = {
        $ne: true,
      }
    }
    const simulationTasks = await collection
      .aggregate<SimulationPulseJob | SimulationBeaconJob>([
        { $match: query },
        ...(params.sortField === 'iterations_count'
          ? [
              {
                $addFields: {
                  iterations_count: { $size: { $ifNull: ['$iterations', []] } },
                },
              },
            ]
          : []),
        {
          $sort: {
            [params.sortField ?? 'createdAt']:
              params.sortOrder === 'ascend' ? 1 : -1,
          },
        },
        ...paginatePipeline(params),
        {
          $project: {
            iterations_count: 0,
          },
        },
      ])
      .toArray()

    const total = await collection.countDocuments(query)

    return {
      total,
      data:
        params.type === 'PULSE'
          ? (simulationTasks.map((task) =>
              omit(task, '_id')
            ) as SimulationPulseJob[])
          : (simulationTasks.map((task) =>
              omit(task, '_id')
            ) as SimulationBeaconJob[]),
    }
  }

  public async getSimulationJobsCount(): Promise<number> {
    const db = this.mongoDb.db()
    const collection = db.collection<SimulationPulseJob | SimulationBeaconJob>(
      SIMULATION_TASK_COLLECTION(this.tenantId)
    )
    return collection.countDocuments({ internal: { $ne: true } })
  }
}
