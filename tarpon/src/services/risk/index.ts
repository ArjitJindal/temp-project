import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb'
import { StackConstants } from '@lib/constants'
import { MongoClient } from 'mongodb'
import { BadRequest } from 'http-errors'
import {
  DEFAULT_RISK_LEVEL,
  getRiskLevelFromScore,
  getRiskScoreFromLevel,
} from '@flagright/lib/utils'
import { intersection, pick } from 'lodash'
import { createV8FactorFromV2 } from '../risk-scoring/risk-factors'
import { isDefaultRiskFactor } from '../risk-scoring/utils'
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
import { auditLog, AuditLogReturnData } from '@/utils/audit-log'
import { DrsScore } from '@/@types/openapi-internal/DrsScore'
import { DefaultApiGetDrsValuesRequest } from '@/@types/openapi-internal/RequestParameters'

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

type RiskClassificationAuditLogReturnData = AuditLogReturnData<
  RiskClassificationScore[],
  RiskClassificationScore[],
  RiskClassificationScore[]
>

type DrsRiskItemAuditLogReturnData = AuditLogReturnData<
  DrsScore,
  DrsScore,
  DrsScore
>

@traceable
export class RiskService {
  tenantId: string
  dynamoDb: DynamoDBDocumentClient
  riskRepository: RiskRepository
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
    this.mongoDb = connections.mongoDb
  }

  async getRiskClassificationValues() {
    return await this.riskRepository.getRiskClassificationValues()
  }

  @auditLog('RISK_SCORING', 'RISK_CLASSIFICATION', 'UPDATE')
  async createOrUpdateRiskClassificationConfig(
    riskClassificationScore: RiskClassificationScore[]
  ): Promise<RiskClassificationAuditLogReturnData> {
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
    return {
      entities: [
        {
          oldImage: oldClassificationValuesAsRiskClassificationScore,
          newImage: newClassificationValues,
          entityId: 'RISK_CLASSIFICATION_VALUES',
        },
      ],
      result: newClassificationValues,
    }
  }

  async getV2RiskFactorID(riskEntityType: string, parameter: string) {
    const riskFactors = await this.riskRepository.getAllRiskFactors()
    const matchingRiskFactor = riskFactors.find(
      (factor) =>
        factor.type === riskEntityType && factor.parameter === parameter
    )
    return matchingRiskFactor?.id
  }

  async getRiskAssignment(userId: string) {
    return this.riskRepository.getDRSRiskItem(userId)
  }

  @auditLog('RISK_SCORING', 'DRS_RISK_LEVEL', 'UPDATE')
  async createOrUpdateRiskAssignment(
    userId: string,
    riskLevel: RiskLevel | undefined,
    isUpdatable?: boolean
  ): Promise<DrsRiskItemAuditLogReturnData> {
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
    const logMetadata = {
      userId: newDrsRiskItem?.userId,
      type: 'MANUAL',
      transactionId: newDrsRiskItem?.transactionId,
      createdAt: newDrsRiskItem?.createdAt,
    }

    return {
      entities: [
        {
          oldImage: oldDrsRiskItem ?? undefined,
          newImage: newDrsRiskItem,
          entityId: userId,
          logMetadata,
        },
      ],
      result: newDrsRiskItem,
    }
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

  async getDrsValuesFromMongo(request: DefaultApiGetDrsValuesRequest) {
    return await this.riskRepository.getDrsScoresForUser(request)
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
    return data.filter((riskFactor) => !riskFactor.parameter)
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

  @auditLog('RISK_FACTOR', 'RISK_FACTOR_V8', 'CREATE')
  async createOrUpdateRiskFactor(
    riskFactor: RiskFactorsUpdateRequest,
    riskFactorId?: string
  ): Promise<AuditLogReturnData<RiskFactor, RiskFactor, RiskFactor>> {
    if (!this.mongoDb) {
      throw new Error('MongoDB connection not available')
    }
    let currentRiskFactor: RiskFactor | null = null
    const isNewRiskFactor = riskFactorId ? false : true

    const id =
      riskFactorId || riskFactor.riskFactorId
        ? riskFactorId && !riskFactor.riskFactorId
          ? riskFactorId
          : await this.getNewRiskFactorId(riskFactor.riskFactorId, true)
        : await this.getNewRiskFactorId(undefined, true)
    if (!riskFactor.riskFactorId && riskFactorId) {
      currentRiskFactor = await this.riskRepository.getRiskFactor(id)
    }
    const isDefaultFactor =
      isDefaultRiskFactor(riskFactor) ||
      (currentRiskFactor && isDefaultRiskFactor(currentRiskFactor))
    const riskClassificationValues =
      await this.riskRepository.getRiskClassificationValues()

    let migratedFactor: Partial<RiskFactor> | null = null

    if (isDefaultFactor) {
      migratedFactor = createMigratedFactor(
        { ...currentRiskFactor, ...riskFactor },
        riskClassificationValues
      )
    }

    const DEFAULT_VALUES: RiskFactorsPostRequest = {
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
      ...(currentRiskFactor ?? DEFAULT_VALUES),
      ...(isDefaultFactor ? migratedFactor : riskFactor),
      id,
      createdAt: currentRiskFactor?.createdAt ?? now,
      updatedAt: now,
    }

    const oldRiskFactor = await this.riskRepository.getRiskFactor(id)

    const updatedData = await this.riskRepository.createOrUpdateRiskFactor(data)

    let auditLogData: AuditLogReturnData<RiskFactor, RiskFactor, RiskFactor> = {
      entities: [
        {
          entityId: id,
          newImage: isDefaultFactor ? createDefaultFactorAuditData(data) : data,
        },
      ],
      result: data,
    }
    if (!isNewRiskFactor && oldRiskFactor) {
      auditLogData = {
        ...auditLogData,
        entities: [
          {
            entityId: id,
            newImage: isDefaultFactor
              ? createDefaultFactorAuditData(data)
              : data,
            oldImage: isDefaultFactor
              ? createDefaultFactorAuditData(oldRiskFactor)
              : oldRiskFactor,
          },
        ],
        actionTypeOverride: 'UPDATE',
      }
    }
    await riskFactorAggregationVariablesRebuild(
      updatedData,
      now,
      this.tenantId,
      this.riskRepository
    )
    this.riskRepository.getAllRiskFactors.cache.clear?.()
    return auditLogData
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

  @auditLog('RISK_FACTOR', 'RISK_FACTOR_V8', 'DELETE')
  async deleteRiskFactor(
    riskFactorId: string
  ): Promise<AuditLogReturnData<void, RiskFactor>> {
    this.riskRepository.getAllRiskFactors.cache.clear?.()
    const riskFactor = await this.riskRepository.getRiskFactor(riskFactorId)
    if (!riskFactor) {
      throw new BadRequest('Risk factor not found')
    }
    await this.riskRepository.deleteRiskFactor(riskFactorId)
    return {
      result: undefined,
      entities: [
        {
          entityId: riskFactorId,
          newImage: riskFactor,
        },
      ],
    }
  }
}

function createDefaultFactorAuditData(riskFactor: RiskFactor): RiskFactor {
  return pick(riskFactor, [
    ...intersection(
      ParameterAttributeRiskValues.attributeTypeMap.map((v) => v.name),
      RiskFactor.attributeTypeMap.map((v) => v.name)
    ),
    'type',
    'id',
    'defaultRiskScore',
    'updatedAt',
    'status',
  ]) as RiskFactor
}

function createMigratedFactor(
  riskFactor: RiskFactorsUpdateRequest,
  riskClassificationValues: RiskClassificationScore[]
): Partial<RiskFactor> {
  return createV8FactorFromV2(
    {
      parameter: riskFactor.parameter as RiskFactorParameter,
      riskEntityType: riskFactor.type ?? 'CONSUMER_USER',
      riskLevelAssignmentValues: riskFactor.riskLevelAssignmentValues ?? [],
      targetIterableParameter: riskFactor.targetIterableParameter,
      isActive: riskFactor.status === 'ACTIVE',
      isDerived: riskFactor.isDerived ?? false,
      weight: riskFactor.defaultWeight ?? 1,
      defaultValue: {
        type: 'RISK_SCORE',
        value:
          riskFactor.defaultRiskScore ??
          getRiskScoreFromLevel(riskClassificationValues, DEFAULT_RISK_LEVEL),
      },
    },
    riskClassificationValues
  )
}
