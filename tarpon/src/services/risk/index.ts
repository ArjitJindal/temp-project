import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb'
import { StackConstants } from '@lib/constants'
import { MongoClient } from 'mongodb'
import { BadRequest } from 'http-errors'
import { PulseAuditLogService } from './pulse-audit-log'
import { RiskRepository } from '@/services/risk-scoring/repositories/risk-repository'
import { RiskClassificationScore } from '@/@types/openapi-internal/RiskClassificationScore'
import {
  ParameterAttributeRiskValues,
  ParameterAttributeRiskValuesParameterEnum,
} from '@/@types/openapi-internal/ParameterAttributeRiskValues'
import { RiskEntityType } from '@/@types/openapi-internal/RiskEntityType'
import { RiskLevel } from '@/@types/openapi-internal/RiskLevel'
import { traceable } from '@/core/xray'

const validateClassificationRequest = (
  classificationValues: Array<RiskClassificationScore>
) => {
  if (classificationValues.length != StackConstants.NUMBER_OF_RISK_LEVELS) {
    throw new BadRequest('Invalid Request - Please provide 5 risk levels')
  }
  const unique = new Set()
  const hasDuplicate = classificationValues.some(
    (element) => unique.size === unique.add(element.riskLevel).size
  )
  if (hasDuplicate) {
    throw new BadRequest('Invalid request - duplicate risk levels')
  }
}

@traceable
export class RiskService {
  tenantId: string
  dynamoDb: DynamoDBDocumentClient
  riskRepository: RiskRepository
  auditLogService: PulseAuditLogService

  constructor(
    tenantId: string,
    connections: { dynamoDb: DynamoDBDocumentClient; mongoDb?: MongoClient }
  ) {
    this.tenantId = tenantId
    this.dynamoDb = connections.dynamoDb
    this.riskRepository = new RiskRepository(tenantId, {
      dynamoDb: this.dynamoDb,
      mongoDb: connections.mongoDb,
    })
    this.auditLogService = new PulseAuditLogService(tenantId)
  }

  async getRiskClassificationValues() {
    return await this.riskRepository.getRiskClassificationValues()
  }

  async createOrUpdateRiskClassificationConfig(
    riskClassificationScore: RiskClassificationScore[]
  ) {
    validateClassificationRequest(riskClassificationScore)
    const oldClassificationValues =
      await this.riskRepository.getRiskClassificationValues()
    const result =
      await this.riskRepository.createOrUpdateRiskClassificationConfig(
        riskClassificationScore
      )
    const newClassificationValues = result.classificationValues
    const oldClassificationValuesAsRiskClassificationScore =
      oldClassificationValues
    await this.auditLogService.handleAuditLogForRiskClassificationsUpdated(
      oldClassificationValuesAsRiskClassificationScore,
      newClassificationValues
    )
    return newClassificationValues
  }

  async getRiskParameter(
    parameter: ParameterAttributeRiskValuesParameterEnum,
    entityType: RiskEntityType
  ) {
    if (parameter == null || entityType == null) {
      throw new BadRequest(
        'Invalid request - please provide parameter and entityType'
      )
    }
    return await this.riskRepository.getParameterRiskItem(
      parameter as ParameterAttributeRiskValuesParameterEnum,
      entityType
    )
  }

  async getAllRiskParameters(): Promise<ParameterAttributeRiskValues[]> {
    return (await this.riskRepository.getParameterRiskItems()) ?? []
  }

  async createOrUpdateRiskParameter(
    parameterAttributeRiskValues: ParameterAttributeRiskValues
  ) {
    const oldParameterRiskItemValue =
      await this.riskRepository.getParameterRiskItem(
        parameterAttributeRiskValues.parameter,
        parameterAttributeRiskValues.riskEntityType
      )
    const newParameterRiskItemValue =
      await this.riskRepository.createOrUpdateParameterRiskItem(
        parameterAttributeRiskValues
      )
    await this.auditLogService.handleParameterRiskItemUpdate(
      oldParameterRiskItemValue,
      newParameterRiskItemValue
    )
    return newParameterRiskItemValue
  }

  async getRiskAssignment(userId: string) {
    return this.riskRepository.getDRSRiskItem(userId)
  }

  async createOrUpdateRiskAssignment(
    userId: string,
    riskLevel: RiskLevel | undefined,
    isUpdatable?: boolean
  ) {
    if (!riskLevel) {
      throw new BadRequest('Invalid request - please provide riskLevel')
    }
    const oldDrsRiskItem = await this.riskRepository.getDRSRiskItem(userId)
    const newDrsRiskItem =
      await this.riskRepository.createOrUpdateManualDRSRiskItem(
        userId,
        riskLevel,
        isUpdatable
      )
    await this.auditLogService.handleDrsUpdate(
      oldDrsRiskItem,
      newDrsRiskItem,
      'MANUAL'
    )
    return newDrsRiskItem
  }

  async getDrsValueFromMongo(userId: string) {
    return await this.riskRepository.getDrsValueFromMongo(userId)
  }

  async getKrsValueFromMongo(userId: string) {
    return await this.riskRepository.getKrsValueFromMongo(userId)
  }

  async getArsValueFromMongo(transactionId: string) {
    return await this.riskRepository.getArsValueFromMongo(transactionId)
  }

  async getAverageArsScoreForUser(userId: string) {
    return await this.riskRepository.getAverageArsScoreForUser(userId)
  }
}
