import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb'
import { StackConstants } from '@lib/constants'
import { MongoClient } from 'mongodb'
import { BadRequest } from 'http-errors'
import {
  DEFAULT_RISK_LEVEL,
  getRiskLevelFromScore,
  getRiskScoreFromLevel,
} from '@flagright/lib/utils'
import {
  createV8FactorFromV2,
  generateV2FactorId,
} from '../risk-scoring/risk-factors'
import { PulseAuditLogService } from './pulse-audit-log'
import { riskFactorAggregationVariablesRebuild } from './utils'
import { RiskRepository } from '@/services/risk-scoring/repositories/risk-repository'
import { RiskClassificationScore } from '@/@types/openapi-internal/RiskClassificationScore'
import { ParameterAttributeRiskValues } from '@/@types/openapi-internal/ParameterAttributeRiskValues'
import { RiskEntityType } from '@/@types/openapi-internal/RiskEntityType'
import { RiskLevel } from '@/@types/openapi-internal/RiskLevel'
import { traceable } from '@/core/xray'
import { RiskFactor } from '@/@types/openapi-internal/RiskFactor'
import { RiskFactorsUpdateRequest } from '@/@types/openapi-internal/RiskFactorsUpdateRequest'
import { RiskFactorsPostRequest } from '@/@types/openapi-internal/RiskFactorsPostRequest'
import { RiskFactorParameter } from '@/@types/openapi-internal/RiskFactorParameter'

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
  mongoDb?: MongoClient

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
    this.mongoDb = connections.mongoDb
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
    parameter: RiskFactorParameter,
    entityType: RiskEntityType
  ) {
    if (parameter == null || entityType == null) {
      throw new BadRequest(
        'Invalid request - please provide parameter and entityType'
      )
    }
    return await this.riskRepository.getParameterRiskItem(
      parameter as RiskFactorParameter,
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
    const riskClassificationScore =
      await this.riskRepository.getRiskClassificationValues()

    const v8Factor = createV8FactorFromV2(
      parameterAttributeRiskValues,
      riskClassificationScore
    )
    // Update the v8 risk factor to keep the logic in sync
    await this.createOrUpdateRiskFactor(
      v8Factor,
      generateV2FactorId(
        parameterAttributeRiskValues.parameter,
        parameterAttributeRiskValues.riskEntityType
      )
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

  async getArsScoreFromDynamo(transactionId: string) {
    return await this.riskRepository.getArsScore(transactionId)
  }

  async getKrsScoreFromDynamo(userId: string) {
    let result = await this.riskRepository.getKrsScore(userId)
    if (result) {
      delete result['PartitionKeyID']
      delete result['SortKeyID']
      const riskClassificationValues =
        await this.riskRepository.getRiskClassificationValues()
      const riskLevel = getRiskLevelFromScore(
        riskClassificationValues,
        result.krsScore
      )
      result = {
        ...result,
        riskLevel: riskLevel,
      }
    }
    return result
  }

  async getAverageArsScore(userId: string) {
    return await this.riskRepository.getAverageArsScore(userId)
  }

  async getAllRiskFactors(
    entityType?: RiskEntityType,
    includeMigratedV2Factors = false
  ) {
    const data = await this.riskRepository.getAllRiskFactors(entityType)
    if (includeMigratedV2Factors) {
      return data
    }
    return data.filter((riskFactor) => riskFactor.id.startsWith('RF'))
  }

  async bulkCreateandReplaceRiskFactors(riskFactors: RiskFactorsPostRequest[]) {
    await this.riskRepository.deleteAllRiskFactors()
    for (const riskFactor of riskFactors) {
      await this.createOrUpdateRiskFactor(riskFactor)
    }
  }

  async getDrsScoreFromDynamo(userId: string) {
    let result = await this.riskRepository.getDrsScore(userId)
    if (result) {
      delete result['PartitionKeyID']
      delete result['SortKeyID']
      const riskClassificationValues =
        await this.riskRepository.getRiskClassificationValues()
      const derivedRiskLevel = getRiskLevelFromScore(
        riskClassificationValues,
        result.drsScore
      )
      result = {
        ...result,
        derivedRiskLevel:
          result?.manualRiskLevel ??
          result?.derivedRiskLevel ??
          derivedRiskLevel,
      }
    }
    return result
  }

  async createOrUpdateRiskFactor(
    riskFactor: RiskFactorsUpdateRequest,
    riskFactorId?: string
  ): Promise<RiskFactor> {
    if (!this.mongoDb) {
      throw new Error('MongoDB connection not available')
    }
    let currentRiskFactor: RiskFactor | null = null
    const id =
      riskFactorId || riskFactor.riskFactorId
        ? riskFactorId && !riskFactor.riskFactorId
          ? riskFactorId
          : await this.getNewRiskFactorId(riskFactor.riskFactorId, true)
        : await this.getNewRiskFactorId(undefined, true)
    if (!riskFactor.riskFactorId && riskFactorId) {
      currentRiskFactor = await this.riskRepository.getRiskFactor(id)
    }

    const riskClassificationValues =
      await this.riskRepository.getRiskClassificationValues()

    const DEFUALT_VALUES: RiskFactorsPostRequest = {
      defaultRiskLevel: DEFAULT_RISK_LEVEL,
      defaultRiskScore: getRiskScoreFromLevel(
        riskClassificationValues,
        DEFAULT_RISK_LEVEL
      ),
      defaultWeight: 1,
      description: '',
      status: 'ACTIVE',
      logicAggregationVariables: [],
      logicEntityVariables: [],
      name: '',
      type: 'CONSUMER_USER',
    }

    const now = Date.now()

    const data: RiskFactor = {
      ...(currentRiskFactor ?? DEFUALT_VALUES),
      ...riskFactor,
      id,
      createdAt: currentRiskFactor?.createdAt ?? now,
      updatedAt: now,
    }
    await this.riskRepository.createOrUpdateRiskFactor(data)
    await riskFactorAggregationVariablesRebuild(
      data,
      now,
      this.tenantId,
      this.riskRepository
    )
    this.riskRepository.getAllRiskFactors.cache.clear?.()
    return data
  }
  async getNewRiskFactorId(riskFactorId?: string, update = false) {
    return await this.riskRepository.getNewRiskFactorId(riskFactorId, update)
  }
  async getRiskFactor(riskFactorId: string): Promise<RiskFactor | null> {
    const data = await this.riskRepository.getRiskFactor(riskFactorId)

    if (!data) {
      throw new BadRequest('Invalid request - risk factor not found')
    }

    return data
  }

  async deleteRiskFactor(riskFactorId: string) {
    this.riskRepository.getAllRiskFactors.cache.clear?.()
    return this.riskRepository.deleteRiskFactor(riskFactorId)
  }
}
