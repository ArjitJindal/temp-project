import { StackConstants } from '@lib/constants'
import { omit } from 'lodash'
import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { UpdateCommand } from '@aws-sdk/lib-dynamodb'
import {
  SimulationAllJobs,
  SimulationStatisticsResult,
} from './simulation-task-repository'
import { traceable } from '@/core/xray'
import { DynamoDbKeys } from '@/core/dynamodb/dynamodb-keys'
import {
  batchGet,
  DynamoDbKey,
  getFromDynamoDb,
  transactWrite,
  TransactWriteOperation,
} from '@/utils/dynamodb'
import { SimulationIteration } from '@/@types/openapi-internal/SimulationIteration'
import { envIs } from '@/utils/env'
import { TaskStatusChange } from '@/@types/openapi-internal/TaskStatusChange'
import { logger } from '@/core/logger'

const handleLocalChangeCapture = async (
  tenantId: string,
  primaryKeys: { PartitionKeyID: string; SortKeyID?: string }[]
) => {
  const { localTarponChangeCaptureHandler } = await import(
    '@/utils/local-dynamodb-change-handler'
  )
  for (const primaryKey of primaryKeys) {
    await localTarponChangeCaptureHandler(tenantId, primaryKey, 'TARPON')
  }
}

@traceable
export class DynamoSimulationTaskRepository {
  private readonly tenantId: string
  private readonly dynamoDb: DynamoDBClient
  private readonly tableName: string

  constructor(tenantId: string, dynamoDb: DynamoDBClient) {
    this.tenantId = tenantId
    this.dynamoDb = dynamoDb
    this.tableName = StackConstants.TARPON_DYNAMODB_TABLE_NAME(this.tenantId)
  }

  public async getSimulationTask(
    jobId: string
  ): Promise<SimulationAllJobs | null> {
    const item = await getFromDynamoDb<SimulationAllJobs>(
      this.dynamoDb,
      this.tableName,
      DynamoDbKeys.SIMULATION_TASK(this.tenantId, jobId)
    )
    if (!item) {
      return null
    }
    return item
  }
  public async saveSimulationTask(simulationTasks: SimulationAllJobs[]) {
    const simulationTaskWriteRequest: TransactWriteOperation[] = []
    const iterationWriteRequests: TransactWriteOperation[] = []
    const simulationKeys: DynamoDbKey[] = []

    for (const task of simulationTasks) {
      if (!task.jobId) {
        continue
      }
      const simulationTaskKey = DynamoDbKeys.SIMULATION_TASK(
        this.tenantId,
        task.jobId
      )
      simulationKeys.push(simulationTaskKey)
      simulationTaskWriteRequest.push({
        Put: {
          TableName: this.tableName,
          Item: {
            ...simulationTaskKey,
            ...task,
          },
        },
      })
      if (task.iterations) {
        for (const iteration of task.iterations) {
          if (!iteration.taskId) {
            continue
          }
          const iterationKey = DynamoDbKeys.SIMULATION_TASK_ITERATION(
            this.tenantId,
            iteration.taskId
          )
          iterationWriteRequests.push({
            Put: {
              TableName: this.tableName,
              Item: {
                ...iterationKey,
                jobId: task.jobId,
              },
            },
          })
        }
      }
    }
    await transactWrite(this.dynamoDb, [
      ...simulationTaskWriteRequest,
      ...iterationWriteRequests,
    ])
    if (envIs('local') || envIs('test')) {
      await handleLocalChangeCapture(this.tenantId, simulationKeys)
    }
  }
  public async getSimulationTasksFromIds(ids: string[]) {
    const results = await batchGet<SimulationAllJobs>(
      this.dynamoDb,
      this.tableName,
      ids.map((id) => DynamoDbKeys.SIMULATION_TASK(this.tenantId, id))
    )
    const resultMap = results.reduce((acc, item) => {
      const jobId = item.jobId as string
      acc[jobId] = omit(item, [
        'PartitionKeyID',
        'SortKeyID',
        '_id',
      ]) as SimulationAllJobs
      return acc
    }, {} as Record<string, SimulationAllJobs>)
    return ids.map((id) => resultMap[id]).filter(Boolean)
  }
  public async setIterationsForSimulationTask(
    jobId: string,
    iterations: SimulationIteration[]
  ) {
    const key = DynamoDbKeys.SIMULATION_TASK(this.tenantId, jobId)
    const updateCommand = new UpdateCommand({
      TableName: this.tableName,
      Key: key,
      UpdateExpression: 'SET iterations = :iterations',
      ExpressionAttributeValues: {
        ':iterations': iterations,
      },
    })
    await this.dynamoDb.send(updateCommand)
    if (envIs('local') || envIs('test')) {
      await handleLocalChangeCapture(this.tenantId, [key])
    }
  }
  private async getTaskIdFromIterationId(
    taskId: string
  ): Promise<string | null> {
    const item = await getFromDynamoDb<SimulationAllJobs>(
      this.dynamoDb,
      this.tableName,
      DynamoDbKeys.SIMULATION_TASK_ITERATION(this.tenantId, taskId)
    )
    if (!item) {
      return null
    }
    const jobId = item.jobId
    if (!jobId) {
      return null
    }
    return jobId
  }

  public async updateStatistics<T extends SimulationStatisticsResult>(
    taskId: string,
    statistics: T
  ): Promise<void> {
    const jobId = await this.getTaskIdFromIterationId(taskId)
    if (!jobId) {
      logger.warn(
        `No jobId found for iteration ${taskId} in simulation task table`
      )
      return
    }
    const key = DynamoDbKeys.SIMULATION_TASK(this.tenantId, jobId)

    const updateCommand = new UpdateCommand({
      TableName: this.tableName,
      Key: key,
      UpdateExpression: 'SET statistics = :statistics',
      ExpressionAttributeValues: {
        ':statistics': statistics,
      },
    })

    await this.dynamoDb.send(updateCommand)

    if (envIs('local') || envIs('test')) {
      await handleLocalChangeCapture(this.tenantId, [key])
    }
  }
  public async updateTaskStatus(
    taskId: string,
    newStatus: TaskStatusChange,
    progress?: number,
    totalEntities?: number
  ) {
    const jobId = await this.getTaskIdFromIterationId(taskId)
    if (!jobId) {
      logger.warn(
        `No jobId found for iteration ${taskId} in simulation task table`
      )
      return
    }
    const task = await this.getSimulationTask(jobId)
    if (!task) {
      logger.warn(`No task found for jobId ${jobId} in simulation task table`)
      return
    }

    const key = DynamoDbKeys.SIMULATION_TASK(this.tenantId, jobId)
    const iterations = task.iterations
    const iterationIndex = iterations.findIndex(
      (iter: SimulationIteration) => iter.taskId === taskId
    )
    if (iterationIndex === -1) {
      logger.warn(
        `No iteration found for taskId ${taskId} in simulation task table`
      )
      return
    }

    const updateExpressions: string[] = []
    const expressionAttributeValues: Record<string, any> = {}

    updateExpressions.push(
      `iterations[${iterationIndex}].latestStatus = :newStatus`
    )
    expressionAttributeValues[':newStatus'] = newStatus

    if (progress) {
      updateExpressions.push(
        `iterations[${iterationIndex}].progress = :progress`
      )
      expressionAttributeValues[':progress'] = progress
    }

    if (totalEntities) {
      updateExpressions.push(
        `iterations[${iterationIndex}].totalEntities = :totalEntities`
      )
      expressionAttributeValues[':totalEntities'] = totalEntities
    }

    updateExpressions.push(
      `iterations[${iterationIndex}].statuses = list_append(if_not_exists(iterations[${iterationIndex}].statuses, :emptyList), :newStatusList)`
    )
    expressionAttributeValues[':emptyList'] = []
    expressionAttributeValues[':newStatusList'] = [newStatus]

    const updateCommand = new UpdateCommand({
      TableName: this.tableName,
      Key: key,
      UpdateExpression: `SET ${updateExpressions.join(', ')}`,
      ExpressionAttributeValues: expressionAttributeValues,
    })

    await this.dynamoDb.send(updateCommand)

    if (envIs('local') || envIs('test')) {
      await handleLocalChangeCapture(this.tenantId, [key])
    }
  }
}
