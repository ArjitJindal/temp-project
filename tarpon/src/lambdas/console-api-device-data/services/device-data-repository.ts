import { MongoClient } from 'mongodb'
import {
  DeviceMetric,
  DeviceMetricTypeEnum,
} from '@/@types/openapi-internal/DeviceMetric'
import { DEVICE_DATA_COLLECTION } from '@/utils/mongodb-definitions'
import { traceable } from '@/core/xray'

@traceable
export class DeviceDataRepository {
  tenantId: string
  connections: {
    mongoDb: MongoClient
  }

  constructor(
    tenantId: string,
    connections: {
      mongoDb: MongoClient
    }
  ) {
    this.tenantId = tenantId
    this.connections = connections
  }

  public async getDeviceDataMongo(
    type: DeviceMetricTypeEnum,
    userId: string,
    transactionId?: string
  ): Promise<DeviceMetric | null> {
    const db = this.connections.mongoDb?.db()
    const collection = db.collection<DeviceMetric>(
      DEVICE_DATA_COLLECTION(this.tenantId)
    )
    return await collection.findOne({
      type,
      userId,
      ...(transactionId && { transactionId }),
    })
  }
}
