import { DynamoDBClient, QueryCommand } from '@aws-sdk/client-dynamodb'
import { StackConstants } from '@lib/constants'
import { v4 as uuidv4 } from 'uuid'
import { omit } from 'lodash'
import pMap from 'p-map'
import { SimulationResult } from './simulation-result-repository'
import { traceable } from '@/core/xray'
import {
  DynamoDbKey,
  TransactWriteOperation,
  batchGet,
  sanitizeMongoObject,
  transactWrite,
} from '@/utils/dynamodb'
import { DynamoDbKeys } from '@/core/dynamodb/dynamodb-keys'
import { isDemoTenant } from '@/utils/tenant'
import { envIs } from '@/utils/env'

const handleLocalChangeCapture = async (
  tenantId: string,
  primaryKeys: DynamoDbKey[]
) => {
  if (envIs('local') || envIs('test')) {
    const { localTarponChangeCaptureHandler } = await import(
      '@/utils/local-dynamodb-change-handler'
    )

    for (const primaryKey of primaryKeys) {
      await localTarponChangeCaptureHandler(tenantId, primaryKey, 'TARPON')
    }
  }
}

@traceable
export class DynamoSimulationResultRepository {
  private readonly tenantId: string
  private readonly dynamoDb: DynamoDBClient
  private readonly tableName: string
  constructor(
    tenantId: string,
    connections: {
      dynamoDb: DynamoDBClient
    }
  ) {
    this.tenantId = tenantId
    this.dynamoDb = connections.dynamoDb
    this.tableName = StackConstants.TARPON_DYNAMODB_TABLE_NAME(this.tenantId)
  }
  public async saveSimulationResult(simulationResults: SimulationResult[]) {
    if (simulationResults.length === 0) {
      return
    }
    const writeOperations: TransactWriteOperation[] = []
    const keys: DynamoDbKey[] = []
    if (isDemoTenant(this.tenantId)) {
      await pMap(
        simulationResults,
        async (result) => {
          result.id = result._id ? result._id.toString() : uuidv4()
          const filterKey =
            'userId' in result
              ? { taskId: result.taskId, userId: result.userId }
              : { taskId: result.taskId, transactionId: result.transactionId }

          const existingResults = await this.findSimulationResultsByFilter(
            filterKey
          )
          for (const existingResult of existingResults) {
            if (existingResult.id) {
              result.id = existingResult.id
            }
            const key = DynamoDbKeys.SIMULATION_RESULT(this.tenantId, result.id)
            keys.push(key)
            const item = {
              ...key,
              ...sanitizeMongoObject(result),
            }

            writeOperations.push({
              Put: {
                TableName: this.tableName,
                Item: item,
              },
            })
          }
        },
        { concurrency: 100 }
      )
    } else {
      for (const result of simulationResults) {
        result.id = result._id ? result._id.toString() : uuidv4()
        const key = DynamoDbKeys.SIMULATION_RESULT(this.tenantId, result.id)
        keys.push(key)
        const item = {
          ...key,
          ...sanitizeMongoObject(result),
        }
        writeOperations.push({
          Put: {
            TableName: this.tableName,
            Item: item,
          },
        })
      }
    }
    await transactWrite(this.dynamoDb, writeOperations)
    await handleLocalChangeCapture(this.tenantId, keys)
  }

  public async findSimulationResultsByFilter(filter: {
    taskId: string
    userId?: string
    transactionId?: string
  }): Promise<SimulationResult[]> {
    const PartitionKeyID = DynamoDbKeys.SIMULATION_RESULT(
      this.tenantId,
      ''
    ).PartitionKeyID
    const command = new QueryCommand({
      TableName: this.tableName,
      KeyConditionExpression: '#partitionKey = :partitionKey',
      FilterExpression:
        '#taskId = :taskId' +
        (filter.userId ? ' AND #userId = :userId' : '') +
        (filter.transactionId ? ' AND #transactionId = :transactionId' : ''),
      ExpressionAttributeNames: {
        '#partitionKey': 'PartitionKeyID',
        '#taskId': 'taskId',
        ...(filter.userId ? { '#userId': 'userId' } : {}),
        ...(filter.transactionId ? { '#transactionId': 'transactionId' } : {}),
      },
      ExpressionAttributeValues: {
        ':partitionKey': { S: PartitionKeyID },
        ':taskId': { S: filter.taskId.trim() },
        ...(filter.userId ? { ':userId': { S: filter.userId } } : {}),
        ...(filter.transactionId
          ? { ':transactionId': { S: filter.transactionId } }
          : {}),
      },
    })

    const response = await this.dynamoDb.send(command)
    const items = (response.Items as unknown as SimulationResult[]) || []

    return items.map((item) => {
      return omit(item, ['PartitionKeyID', 'SortKeyID']) as SimulationResult
    })
  }

  public async getSimulationResultsFromIds(
    ids: string[]
  ): Promise<SimulationResult[]> {
    const results = await batchGet<SimulationResult>(
      this.dynamoDb,
      this.tableName,
      ids.map((id) => DynamoDbKeys.SIMULATION_RESULT(this.tenantId, id))
    )
    const resultMap = results.reduce((acc, item) => {
      const id = item.id as string
      acc[id] = omit(item, ['PartitionKeyID', 'SortKeyID']) as SimulationResult
      return acc
    }, {} as Record<string, SimulationResult>)
    return ids.map((id) => resultMap[id]).filter(Boolean)
  }
  public async batchSaveSimulationResults(
    simulationResults: SimulationResult[]
  ) {
    if (simulationResults.length === 0) {
      return
    }
    const writeOperations: TransactWriteOperation[] = []
    const keys: DynamoDbKey[] = []
    for (const result of simulationResults) {
      result.id = result._id ? result._id.toString() : uuidv4()
      const key = DynamoDbKeys.SIMULATION_RESULT(this.tenantId, result.id)
      const item = {
        ...key,
        ...sanitizeMongoObject(result),
      }
      writeOperations.push({
        Put: {
          TableName: this.tableName,
          Item: item,
        },
      })
    }
    await transactWrite(this.dynamoDb, writeOperations)
    await handleLocalChangeCapture(this.tenantId, keys)
  }
}
