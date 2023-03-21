import { MongoClient } from 'mongodb'
import { DeviceDataRepository } from './device-data-repository'

export class DeviceDataService {
  tenantId: string
  connections: {
    mongoDb: MongoClient
  }
  deviceDataRepository: DeviceDataRepository

  constructor(
    tenantId: string,
    connections: {
      mongoDb: MongoClient
    }
  ) {
    this.tenantId = tenantId
    this.connections = connections
    this.deviceDataRepository = new DeviceDataRepository(tenantId, connections)
  }

  private async getDeviceData(userId: string, transactionId?: string) {
    return await this.deviceDataRepository.getDeviceDataMongo(
      userId,
      transactionId
    )
  }

  public async getDeviceDataForUser(userId: string) {
    return await this.getDeviceData(userId)
  }

  public async getDeviceDataForTransaction(
    userId: string,
    transactionId: string
  ) {
    return await this.getDeviceData(userId, transactionId)
  }
}
