import { StackConstants } from '@lib/constants'
import {
  DynamoDBDocumentClient,
  GetCommand,
  GetCommandInput,
  PutCommand,
  PutCommandInput,
  UpdateCommand,
  QueryCommand,
  QueryCommandInput,
  NativeAttributeValue,
} from '@aws-sdk/lib-dynamodb'
import { omit } from 'lodash'
import { BatchJobFilterUtils } from './filter-utils'
import { traceable } from '@/core/xray'
import { DynamoDbKeys } from '@/core/dynamodb/dynamodb-keys'
import { sanitizeMongoObject, DynamoTransactionBatch } from '@/utils/dynamodb'
import {
  BatchJobInDb,
  BatchJobParams,
  RulePreAggregationMetadata,
  BatchJobType,
  BatchJobParameters,
} from '@/@types/batch-job'
import {
  TaskStatusChange,
  TaskStatusChangeStatusEnum,
} from '@/@types/openapi-internal/TaskStatusChange'
import { envIs } from '@/utils/env'

@traceable
export class DynamoBatchJobRepository {
  private readonly tenantId: string
  private readonly dynamoDb: DynamoDBDocumentClient
  private readonly tableName: string

  constructor(tenantId: string, dynamoDb: DynamoDBDocumentClient) {
    this.tenantId = tenantId
    this.dynamoDb = dynamoDb
    this.tableName = StackConstants.TARPON_DYNAMODB_TABLE_NAME(this.tenantId)
  }

  public async saveJobs(jobs: BatchJobInDb[]): Promise<void> {
    const keys: {
      PartitionKeyID: string
      SortKeyID: string
    }[] = []

    // Create batch for operations
    const batch = new DynamoTransactionBatch(this.dynamoDb, this.tableName)

    for (const job of jobs) {
      const key = DynamoDbKeys.JOBS(this.tenantId, job.jobId)
      const data = omit(sanitizeMongoObject(job), ['_id'])
      keys.push(key)

      batch.put({
        Item: {
          ...key,
          ...data,
        },
      })
    }

    await batch.execute()
    if (envIs('local') || envIs('test')) {
      await handleLocalChangeCapture(this.tenantId, keys)
    }
  }
  public async getJobById(jobId: string): Promise<BatchJobInDb | null> {
    const key = DynamoDbKeys.JOBS(this.tenantId, jobId)
    const command = new GetCommand({
      TableName: this.tableName,
      Key: key,
    })
    const result = await this.dynamoDb.send(command)
    return omit(result.Item, ['PartitionKeyID', 'SortKeyID']) as BatchJobInDb
  }

  public async updateJobStatus(
    jobId: string,
    latestStatus: TaskStatusChange
  ): Promise<void> {
    const key = DynamoDbKeys.JOBS(this.tenantId, jobId)
    await this.dynamoDb.send(
      new UpdateCommand({
        TableName: this.tableName,
        Key: key,
        UpdateExpression: `
          SET latestStatus = :latestStatus,
              statuses = list_append(if_not_exists(statuses, :emptyList), :newStatus)
        `,
        ExpressionAttributeValues: {
          ':latestStatus': latestStatus,
          ':newStatus': [latestStatus],
          ':emptyList': [],
        },
      })
    )
    if (envIs('local') || envIs('test')) {
      await handleLocalChangeCapture(this.tenantId, [key])
    }
  }

  public async updateJob(
    jobId: string,
    updatedJob: BatchJobInDb
  ): Promise<BatchJobInDb> {
    const key = DynamoDbKeys.JOBS(this.tenantId, jobId)
    const putItemInput: PutCommandInput = {
      TableName: this.tableName,
      Item: {
        ...key,
        ...updatedJob,
      },
    }
    await this.dynamoDb.send(new PutCommand(putItemInput))

    const getItemInput: GetCommandInput = {
      TableName: this.tableName,
      Key: key,
    }
    const result = await this.dynamoDb.send(new GetCommand(getItemInput))
    if (envIs('local') || envIs('test')) {
      await handleLocalChangeCapture(this.tenantId, [key])
    }
    return sanitizeMongoObject(result.Item) as BatchJobInDb
  }
  public async updateJobScheduleAndParameters(
    jobId: string,
    addScheduledAt: number,
    parameters?: BatchJobParameters
  ): Promise<BatchJobInDb> {
    const key = DynamoDbKeys.JOBS(this.tenantId, jobId)
    const getItemInput: GetCommandInput = {
      TableName: this.tableName,
      Key: key,
      ProjectionExpression:
        'latestStatus.scheduledAt, #params.userIds, #params.clearedListIds',
      ExpressionAttributeNames: {
        '#params': 'parameters',
      },
    }
    const currentItemOutput = await this.dynamoDb.send(
      new GetCommand(getItemInput)
    )

    let currentJob: BatchJobInDb | null = null
    if (currentItemOutput.Item) {
      currentJob = sanitizeMongoObject(currentItemOutput.Item) as BatchJobInDb
    }

    const updateExpressions: string[] = []
    const expressionAttributeValues: Record<string, NativeAttributeValue> = {}
    const expressionAttributeNames: Record<string, string> = {}

    const newScheduledAt =
      (currentJob?.latestStatus?.scheduledAt || Date.now()) + addScheduledAt
    updateExpressions.push('latestStatus.scheduledAt = :newScheduledAt')
    expressionAttributeValues[':newScheduledAt'] = newScheduledAt

    if (parameters?.ruleInstancesIds) {
      updateExpressions.push('#params.ruleInstancesIds = :ruleInstancesIds')
      expressionAttributeValues[':ruleInstancesIds'] =
        parameters.ruleInstancesIds
      expressionAttributeNames['#params'] = 'parameters'
    }

    if (parameters?.userIds && parameters.userIds.length > 0) {
      const currentUsers = new Set(currentJob?.parameters?.userIds || [])
      const newUsersToAdd = parameters.userIds.filter(
        (id) => !currentUsers.has(id)
      )

      if (newUsersToAdd.length > 0) {
        const combinedUsers: string[] = [...currentUsers, ...newUsersToAdd]
        updateExpressions.push('#params.userIds = :userIds')
        expressionAttributeValues[':userIds'] = combinedUsers
        expressionAttributeNames['#params'] = 'parameters'
      }
    }

    if (parameters?.clearedListIds) {
      const currentClearedListIds = new Set(
        currentJob?.parameters?.clearedListIds || []
      )
      if (
        parameters.clearedListIds &&
        parameters.clearedListIds.length > 0 &&
        !currentClearedListIds.has(parameters.clearedListIds[0])
      ) {
        const combinedClearedListIds = [
          ...currentClearedListIds,
          parameters.clearedListIds,
        ]
        updateExpressions.push('#params.clearedListIds = :clearedListIds')
        expressionAttributeValues[':clearedListIds'] = combinedClearedListIds
        expressionAttributeNames['#params'] = 'parameters'
      }
    }

    const updateExpression =
      updateExpressions.length > 0 ? `SET ${updateExpressions.join(', ')}` : ''

    const result = await this.dynamoDb.send(
      new UpdateCommand({
        TableName: this.tableName,
        Key: key,
        UpdateExpression: updateExpression,
        ExpressionAttributeValues: expressionAttributeValues,
        ...(Object.keys(expressionAttributeNames).length > 0 && {
          ExpressionAttributeNames: expressionAttributeNames,
        }),
        ReturnValues: 'ALL_NEW',
      })
    )
    if (envIs('local') || envIs('test')) {
      await handleLocalChangeCapture(this.tenantId, [key])
    }
    return sanitizeMongoObject(result.Attributes) as BatchJobInDb
  }
  public async setMetadata(
    jobId: string,
    metadata: RulePreAggregationMetadata
  ): Promise<BatchJobInDb> {
    const key = DynamoDbKeys.JOBS(this.tenantId, jobId)

    const updateExpression = 'SET #metadata = :metadataValue'
    const expressionAttributeNames = {
      '#metadata': 'metadata',
    }
    const expressionAttributeValues = {
      ':metadataValue': metadata,
    }

    const result = await this.dynamoDb.send(
      new UpdateCommand({
        TableName: this.tableName,
        Key: key,
        UpdateExpression: updateExpression,
        ExpressionAttributeNames: expressionAttributeNames,
        ExpressionAttributeValues: expressionAttributeValues,
        ReturnValues: 'ALL_NEW',
      })
    )

    if (envIs('local') || envIs('test')) {
      await handleLocalChangeCapture(this.tenantId, [key])
    }
    return sanitizeMongoObject(result.Attributes) as BatchJobInDb
  }
  public async incrementCompleteTasksCount(
    jobId: string
  ): Promise<BatchJobInDb> {
    const key = DynamoDbKeys.JOBS(this.tenantId, jobId)

    const updateExpression = 'ADD #metadata.#completeTasksCount :incrementValue'
    const expressionAttributeNames = {
      '#metadata': 'metadata',
      '#completeTasksCount': 'completeTasksCount',
    }
    const expressionAttributeValues = {
      ':incrementValue': 1,
    }

    const result = await this.dynamoDb.send(
      new UpdateCommand({
        TableName: this.tableName,
        Key: key,
        UpdateExpression: updateExpression,
        ExpressionAttributeNames: expressionAttributeNames,
        ExpressionAttributeValues: expressionAttributeValues,
        ReturnValues: 'ALL_NEW',
      })
    )
    if (envIs('local') || envIs('test')) {
      await handleLocalChangeCapture(this.tenantId, [key])
    }
    return sanitizeMongoObject(result.Attributes) as BatchJobInDb
  }
  public async incrementMetadataTasksCount(
    jobId: string,
    tasksCount: number
  ): Promise<BatchJobInDb> {
    const key = DynamoDbKeys.JOBS(this.tenantId, jobId)

    const updateExpression = 'ADD #metadata.#tasksCount :tasksCountValue'
    const expressionAttributeNames = {
      '#metadata': 'metadata',
      '#tasksCount': 'tasksCount',
    }
    const expressionAttributeValues = {
      ':tasksCountValue': tasksCount,
    }

    const result = await this.dynamoDb.send(
      new UpdateCommand({
        TableName: this.tableName,
        Key: key,
        UpdateExpression: updateExpression,
        ExpressionAttributeNames: expressionAttributeNames,
        ExpressionAttributeValues: expressionAttributeValues,
        ReturnValues: 'ALL_NEW',
      })
    )

    if (envIs('local') || envIs('test')) {
      await handleLocalChangeCapture(this.tenantId, [key])
    }
    return sanitizeMongoObject(result.Attributes) as BatchJobInDb
  }
  public async getJobs(
    filters: BatchJobParams,
    limit: number = 20
  ): Promise<BatchJobInDb[]> {
    const {
      filterExpressions,
      expressionAttributeValues,
      expressionAttributeNames,
    } = BatchJobFilterUtils.buildDynamoFilters(filters)

    const { PartitionKeyID } = DynamoDbKeys.JOBS(this.tenantId, '')

    const queryParams: QueryCommandInput = {
      TableName: this.tableName,
      KeyConditionExpression: 'PartitionKeyID = :partitionKey',
      FilterExpression:
        filterExpressions.length > 0
          ? filterExpressions.join(' AND ')
          : undefined,
      ExpressionAttributeValues: {
        ':partitionKey': PartitionKeyID,
        ...expressionAttributeValues,
      },
      ExpressionAttributeNames:
        Object.keys(expressionAttributeNames).length > 0
          ? expressionAttributeNames
          : undefined,
      Limit: limit,
    }

    const result = await this.dynamoDb.send(new QueryCommand(queryParams))

    if (!result.Items) {
      return []
    }

    return result.Items.map((item) =>
      omit(sanitizeMongoObject(item), ['PartitionKeyID', 'SortKeyID'])
    ) as BatchJobInDb[]
  }
  public async getJobsByStatus(
    latestStatuses: TaskStatusChangeStatusEnum[],
    params?: {
      filterTypes?: BatchJobType[]
    }
  ): Promise<BatchJobInDb[]> {
    const filterExpressions: string[] = []
    const expressionAttributeValues: Record<string, NativeAttributeValue> = {}
    const expressionAttributeNames: Record<string, string> = {}

    if (latestStatuses.length > 0) {
      const statusPlaceholders = latestStatuses.map(
        (_, index) => `:status${index}`
      )
      filterExpressions.push(
        `latestStatus.#status IN (${statusPlaceholders.join(', ')})`
      )
      latestStatuses.forEach((status, index) => {
        expressionAttributeValues[`:status${index}`] = status
      })
      expressionAttributeNames['#status'] = 'status'
    }

    if (params?.filterTypes && params.filterTypes.length > 0) {
      const typePlaceholders = params.filterTypes.map(
        (_, index) => `:type${index}`
      )
      filterExpressions.push(`#type IN (${typePlaceholders.join(', ')})`)
      params.filterTypes.forEach((type, index) => {
        expressionAttributeValues[`:type${index}`] = type
      })
      expressionAttributeNames['#type'] = 'type'
    }

    const { PartitionKeyID } = DynamoDbKeys.JOBS(this.tenantId, '')

    const queryParams: QueryCommandInput = {
      TableName: this.tableName,
      KeyConditionExpression: 'PartitionKeyID = :partitionKey',
      FilterExpression:
        filterExpressions.length > 0
          ? filterExpressions.join(' AND ')
          : undefined,
      ExpressionAttributeValues: {
        ':partitionKey': PartitionKeyID,
        ...expressionAttributeValues,
      },
      ExpressionAttributeNames:
        Object.keys(expressionAttributeNames).length > 0
          ? expressionAttributeNames
          : undefined,
    }

    const result = await this.dynamoDb.send(new QueryCommand(queryParams))

    if (!result.Items) {
      return []
    }

    return result.Items.map((item) =>
      omit(sanitizeMongoObject(item), ['PartitionKeyID', 'SortKeyID'])
    ) as BatchJobInDb[]
  }
  public async isAnyJobRunning(type: BatchJobType): Promise<boolean> {
    const { PartitionKeyID } = DynamoDbKeys.JOBS(this.tenantId, '')

    const queryParams: QueryCommandInput = {
      TableName: this.tableName,
      KeyConditionExpression: 'PartitionKeyID = :partitionKey',
      FilterExpression:
        '#type = :type AND latestStatus.#status IN (:pending, :inProgress)',
      ExpressionAttributeValues: {
        ':partitionKey': PartitionKeyID,
        ':type': type,
        ':pending': 'PENDING',
        ':inProgress': 'IN_PROGRESS',
      },
      ExpressionAttributeNames: {
        '#type': 'type',
        '#status': 'status',
      },
      Limit: 1,
    }

    const result = await this.dynamoDb.send(new QueryCommand(queryParams))
    return (result.Items?.length ?? 0) > 0
  }
}

const handleLocalChangeCapture = async (
  tenantId: string,
  primaryKey: { PartitionKeyID: string; SortKeyID?: string }[]
) => {
  const { localTarponChangeCaptureHandler } = await import(
    '@/utils/local-dynamodb-change-handler'
  )
  for (const key of primaryKey) {
    await localTarponChangeCaptureHandler(tenantId, key, 'TARPON')
  }
}
