import { MongoClient } from 'mongodb'
import { NotFound } from 'http-errors'
import { DeviceDataRepository } from './device-data-repository'
import { DeviceMetricTypeEnum } from '@/@types/openapi-internal/DeviceMetric'
import { traceable } from '@/core/xray'

@traceable
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
    const data = await this.getDeviceData('USER_SIGNUP', userId)
    if (!data) {
      throw new NotFound('Device data not found')
    }
    return data
  }

  public async getDeviceDataForTransaction(
    userId: string,
    transactionId: string
  ) {
    const data = await this.getDeviceData('TRANSACTION', userId, transactionId)
    if (!data) {
      throw new NotFound('Device data not found')
    }
    return data
  }
}
