import { MongoClient } from 'mongodb'
import { DeviceDataRepository } from './device-data-repository'
import { DeviceMetricTypeEnum } from '@/@types/openapi-internal/DeviceMetric'

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

  private async getDeviceData(
    type: DeviceMetricTypeEnum,
    userId: string,
    transactionId?: string
  ) {
    return await this.deviceDataRepository.getDeviceDataMongo(
      type,
      userId,
      transactionId
    )
  }

  public async getDeviceDataForUser(userId: string) {
    return await this.getDeviceData('USER_SIGNUP', userId)
  }

  public async getDeviceDataForTransaction(
    userId: string,
    transactionId: string
  ) {
    return await this.getDeviceData('TRANSACTION', userId, transactionId)
  }
}
