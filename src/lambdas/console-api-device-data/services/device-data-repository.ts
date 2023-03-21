import { MongoClient } from 'mongodb'
import { DeviceMetric } from '@/@types/openapi-internal/DeviceMetric'
import { DEVICE_DATA_COLLECTION } from '@/utils/mongoDBUtils'

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
    userId: string,
    transactionId?: string
  ): Promise<DeviceMetric | null> {
    const db = this.connections.mongoDb?.db()
    const collection = db.collection<DeviceMetric>(
      DEVICE_DATA_COLLECTION(this.tenantId)
    )
    return await collection.findOne({
      userId,
      transactionId: transactionId ? transactionId : { $exists: false },
    })
  }
}
