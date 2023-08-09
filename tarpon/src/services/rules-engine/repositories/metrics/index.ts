import { Filter, MongoClient } from 'mongodb'
import { StackConstants } from '@lib/constants'
import {
  DynamoDBDocumentClient,
  PutCommand,
  PutCommandInput,
} from '@aws-sdk/lib-dynamodb'
import { v4 as uuidv4 } from 'uuid'
import { DynamoDbKeys } from '@/core/dynamodb/dynamodb-keys'
import { DEVICE_DATA_COLLECTION } from '@/utils/mongoDBUtils'
import { DeviceMetric } from '@/@types/openapi-public-device-data/DeviceMetric'
import { runLocalChangeHandler } from '@/utils/local-dynamodb-change-handler'
import { traceable } from '@/core/xray'

@traceable
export class MetricsRepository {
  dynamoDb: DynamoDBDocumentClient
  mongoDb: MongoClient
  tenantId: string

  constructor(
    tenantId: string,
    connections: {
      dynamoDb?: DynamoDBDocumentClient
      mongoDb?: MongoClient
    }
  ) {
    this.dynamoDb = connections.dynamoDb as DynamoDBDocumentClient
    this.mongoDb = connections.mongoDb as MongoClient
    this.tenantId = tenantId
  }

  public async getMongoUserMetrics({
    userId,
    deviceFingerprint,
  }: {
    userId?: string
    deviceFingerprint?: string
  }): Promise<DeviceMetric[] | null> {
    if (!userId && !deviceFingerprint) {
      throw new Error('One of userId or deviceFingerprint must be provided')
    }
    const db = this.mongoDb.db()
    const collection = db.collection<DeviceMetric>(
      DEVICE_DATA_COLLECTION(this.tenantId)
    )
    const filter: Filter<DeviceMetric> = {}
    if (userId) {
      filter.userId = userId
    }
    if (deviceFingerprint) {
      filter.deviceFingerprint = deviceFingerprint
    }
    return await collection.find(filter).toArray()
  }

  public async saveUserMetric(
    deviceMetric: DeviceMetric
  ): Promise<DeviceMetric> {
    return (await this.saveMetric(deviceMetric)) as DeviceMetric
  }

  public async saveMetric(deviceMetric: DeviceMetric): Promise<DeviceMetric> {
    const { userId, type, timestamp } = deviceMetric

    const primaryKey = DynamoDbKeys.DEVICE_DATA_METRICS(
      this.tenantId,
      userId,
      type,
      timestamp
    )
    const putItemInput: PutCommandInput = {
      TableName: StackConstants.TARPON_DYNAMODB_TABLE_NAME,
      Item: {
        ...primaryKey,
        metricId: deviceMetric.metricId ?? uuidv4(),
        ...deviceMetric,
      },
    }
    await this.dynamoDb.send(new PutCommand(putItemInput))

    if (runLocalChangeHandler()) {
      const { localTarponChangeCaptureHandler } = await import(
        '@/utils/local-dynamodb-change-handler'
      )
      await localTarponChangeCaptureHandler(primaryKey)
    }
    return deviceMetric
  }

  public async saveMetricMongo(
    deviceMetric: DeviceMetric
  ): Promise<DeviceMetric> {
    const db = this.mongoDb.db()
    const deviceMetricCollection = db.collection<DeviceMetric>(
      DEVICE_DATA_COLLECTION(this.tenantId)
    )
    await deviceMetricCollection.replaceOne(
      { metric: deviceMetric.metricId },
      deviceMetric,
      {
        upsert: true,
      }
    )
    return deviceMetric
  }

  public async getMetricById(userId: string): Promise<DeviceMetric | null> {
    const db = this.mongoDb.db()
    const collection = db.collection<DeviceMetric>(
      DEVICE_DATA_COLLECTION(this.tenantId)
    )
    return collection.findOne<DeviceMetric>({
      userId,
    })
  }

  public async getMetricsById(
    userIds: string[],
    transactionIds?: string[]
  ): Promise<DeviceMetric[] | null> {
    const db = this.mongoDb.db()
    const collection = db.collection<DeviceMetric>(
      DEVICE_DATA_COLLECTION(this.tenantId)
    )
    const filter = {
      userId: { $in: userIds },
      transactionId: { $in: transactionIds },
    }
    const result = await collection.find(filter).toArray()
    return result
  }
}
