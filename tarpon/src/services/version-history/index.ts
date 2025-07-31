import { MongoClient } from 'mongodb'
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb'
import { padStart } from 'lodash'
import { InternalServerError, NotFound } from 'http-errors'
import { CounterEntity, CounterRepository } from '../counter/repository'
import { RiskService } from '../risk'
import { VersionHistoryRepository } from './repository'
import { VersionHistory } from '@/@types/openapi-internal/VersionHistory'
import { DefaultApiGetVersionHistoryRequest } from '@/@types/openapi-internal/RequestParameters'
import { FLAGRIGHT_SYSTEM_USER } from '@/utils/user'
import { getContext } from '@/core/utils/context-storage'
import { PaginatedVersionHistory } from '@/@types/openapi-internal/PaginatedVersionHistory'
import { traceable } from '@/core/xray'
import { VersionHistoryRestorePayload } from '@/@types/openapi-internal/VersionHistoryRestorePayload'
import { RiskClassificationScore } from '@/@types/openapi-internal/RiskClassificationScore'
import { RiskFactorsUpdate } from '@/@types/openapi-internal/RiskFactorsUpdate'

type Prefix = 'RLV' | 'RFV'

@traceable
export class VersionHistoryService {
  tenantId: string
  mongoDb: MongoClient
  dynamoDb: DynamoDBDocumentClient
  versionHistoryRepository: VersionHistoryRepository
  counterRepository: CounterRepository

  constructor(
    tenantId: string,
    connections: { mongoDb: MongoClient; dynamoDb: DynamoDBDocumentClient }
  ) {
    this.tenantId = tenantId
    this.mongoDb = connections.mongoDb
    this.dynamoDb = connections.dynamoDb
    this.versionHistoryRepository = new VersionHistoryRepository(
      tenantId,
      connections
    )
    this.counterRepository = new CounterRepository(tenantId, connections)
  }

  private getCounterTypeAndPrefix(type: VersionHistory['type']): {
    counterType: CounterEntity
    prefix: Prefix
  } {
    switch (type) {
      case 'RiskClassification':
        return { counterType: 'RiskLevel', prefix: 'RLV' }
      case 'RiskFactors':
        return { counterType: 'RiskFactors', prefix: 'RFV' }
      default:
        throw new InternalServerError(`Invalid type: ${type}`)
    }
  }

  async createVersionHistory(
    type: VersionHistory['type'],
    data: VersionHistory['data'],
    comment: string
  ): Promise<VersionHistory> {
    const { counterType, prefix } = this.getCounterTypeAndPrefix(type)

    const counter = await this.counterRepository.getNextCounterAndUpdate(
      counterType
    )

    const id = `${prefix}-${padStart(counter.toString(), 3, '0')}`
    const versionHistory: VersionHistory = {
      type,
      data,
      comment,
      createdBy: getContext()?.user?.id ?? FLAGRIGHT_SYSTEM_USER,
      id,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }

    await this.versionHistoryRepository.createVersionHistory(versionHistory)

    return versionHistory
  }

  private async getVersionHistory(params: DefaultApiGetVersionHistoryRequest) {
    return this.versionHistoryRepository.getVersionHistory(params)
  }

  async getVersionHistoryById(id: string) {
    return this.versionHistoryRepository.getVersionHistoryById(id)
  }

  private async getVersionHistoryCount(
    params: DefaultApiGetVersionHistoryRequest
  ) {
    return this.versionHistoryRepository.getVersionHistoryCount(params)
  }

  async getNewVersionId(type: VersionHistory['type']): Promise<string> {
    const { counterType, prefix } = this.getCounterTypeAndPrefix(type)
    const counter = await this.counterRepository.getNextCounter(counterType)
    return `${prefix}-${padStart(counter.toString(), 3, '0')}`
  }

  async getRiskClassificationHistory(
    params: DefaultApiGetVersionHistoryRequest
  ): Promise<PaginatedVersionHistory> {
    const [result, count] = await Promise.all([
      this.getVersionHistory(params),
      this.getVersionHistoryCount(params),
    ])
    return {
      items: result,
      total: count,
    }
  }

  async restoreVersionHistory(request: VersionHistoryRestorePayload) {
    const { comment, versionId, type } = request
    const versionHistory = await this.getVersionHistoryById(versionId)
    if (!versionHistory || versionHistory.type !== type) {
      throw new NotFound(`Version history not found: ${versionId}`)
    }

    switch (type) {
      case 'RiskClassification': {
        const service = new RiskService(this.tenantId, {
          mongoDb: this.mongoDb,
          dynamoDb: this.dynamoDb,
        })
        await service.createOrUpdateRiskClassificationConfig(
          versionHistory.data as RiskClassificationScore[],
          comment
        )
        break
      }
      case 'RiskFactors': {
        const service = new RiskService(this.tenantId, {
          mongoDb: this.mongoDb,
          dynamoDb: this.dynamoDb,
        })

        await service.updateRiskFactors(
          versionHistory.data as RiskFactorsUpdate[],
          comment
        )

        break
      }
      default:
        throw new InternalServerError(`Invalid type: ${type}`)
    }
  }
}
