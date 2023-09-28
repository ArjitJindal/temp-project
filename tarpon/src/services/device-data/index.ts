import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb'
import { MongoClient } from 'mongodb'
import { isEmpty, omitBy } from 'lodash'
import { MetricsRepository } from '../rules-engine/repositories/metrics'
import { RulesEngineService } from '../rules-engine'
import { DynamoDbTransactionRepository } from '../rules-engine/repositories/dynamodb-transaction-repository'
import { DeviceMetric } from '@/@types/openapi-internal/DeviceMetric'
import { traceable } from '@/core/xray'
import { TransactionEvent } from '@/@types/openapi-internal/TransactionEvent'
import { DeviceData } from '@/@types/openapi-public/DeviceData'

@traceable
export class DeviceDataService {
  private tenantId: string
  private mongoDb: MongoClient
  private dynamoDb: DynamoDBDocumentClient

  constructor(
    tenantId: string,
    connections: { mongoDb: MongoClient; dynamoDb: DynamoDBDocumentClient }
  ) {
    this.tenantId = tenantId
    this.mongoDb = connections.mongoDb
    this.dynamoDb = connections.dynamoDb
  }

  public async saveDeviceData(deviceMetric: DeviceMetric) {
    const metricsRepository = new MetricsRepository(this.tenantId, {
      mongoDb: this.mongoDb,
      dynamoDb: this.dynamoDb,
    })

    await metricsRepository.saveMetric(deviceMetric)

    if (!deviceMetric.transactionId) {
      return
    }

    const transactionRepository = new DynamoDbTransactionRepository(
      this.tenantId,
      this.dynamoDb
    )

    const transaction = await transactionRepository.getTransactionById(
      deviceMetric.transactionId
    )

    if (!transaction) {
      return
    }

    const rulesEngineService = new RulesEngineService(
      this.tenantId,
      this.dynamoDb,
      this.mongoDb
    )

    const deviceDataMapping: DeviceData = {
      batteryLevel: deviceMetric.batteryLevel,
      deviceIdentifier: deviceMetric.deviceFingerprint,
      deviceLatitude: deviceMetric.location?.latitude,
      deviceLongitude: deviceMetric.location?.longitude,
      deviceMaker: deviceMetric.manufacturer,
      deviceModel: deviceMetric.model,
      ipAddress: deviceMetric.ipAddress,
      operatingSystem: deviceMetric.androidId,
    }

    const transactionEvent: TransactionEvent = {
      timestamp: deviceMetric.timestamp,
      eventId: `device-data-${
        deviceMetric.metricId ?? deviceMetric.transactionId
      }`,
      transactionId: deviceMetric.transactionId,
      transactionState: transaction.transactionState ?? 'CREATED',
      metaData: {
        ...omitBy(deviceDataMapping, isEmpty),
      },
      eventDescription: `Event triggered by device data`,
      updatedTransactionAttributes: {
        originDeviceData: {
          ...omitBy(deviceDataMapping, isEmpty),
        },
      },
    }

    await rulesEngineService.verifyTransactionEvent(transactionEvent)
  }
}
