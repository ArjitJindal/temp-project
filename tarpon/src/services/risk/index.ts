import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb'
import { StackConstants } from '@lib/constants'
import { MongoClient } from 'mongodb'
import { BadRequest } from 'http-errors'
import {
  DEFAULT_RISK_LEVEL,
  getRiskLevelFromScore,
  getRiskScoreFromLevel,
} from '@flagright/lib/utils'
import { intersection, padStart, pick } from 'lodash'
import {
  RiskLevelApprovalWorkflowMachine,
  RiskFactorsApprovalWorkflowMachine,
} from '@flagright/lib/classes/workflow-machine'
import { createV8FactorFromV2 } from '../risk-scoring/risk-factors'
import { isDefaultRiskFactor } from '../risk-scoring/utils'
import { CounterRepository } from '../counter/repository'
import { WorkflowService } from '../workflow'
import { VersionHistoryService } from '../version-history'
import { riskFactorAggregationVariablesRebuild } from './utils'
import {
  DEFAULT_CLASSIFICATION_SETTINGS,
  RiskRepository,
} from '@/services/risk-scoring/repositories/risk-repository'
import { RiskClassificationScore } from '@/@types/openapi-internal/RiskClassificationScore'
import { ParameterAttributeRiskValues } from '@/@types/openapi-internal/ParameterAttributeRiskValues'
import { RiskEntityType } from '@/@types/openapi-internal/RiskEntityType'
import { RiskLevel } from '@/@types/openapi-internal/RiskLevel'
import { traceable } from '@/core/xray'
import { RiskFactor } from '@/@types/openapi-internal/RiskFactor'
import { RiskFactorsUpdate } from '@/@types/openapi-internal/RiskFactorsUpdate'
import { RiskFactorsPostRequest } from '@/@types/openapi-internal/RiskFactorsPostRequest'
import { RiskFactorParameter } from '@/@types/openapi-internal/RiskFactorParameter'
import { auditLog, AuditLogReturnData } from '@/utils/audit-log'
import { AuditLog } from '@/@types/openapi-internal/AuditLog'
import { publishAuditLog } from '@/services/audit-log'
import { DrsScore } from '@/@types/openapi-internal/DrsScore'
import { DefaultApiGetDrsValuesRequest } from '@/@types/openapi-internal/RequestParameters'
import { RiskClassificationConfig } from '@/@types/openapi-internal/RiskClassificationConfig'
import { RiskClassificationConfigApproval } from '@/@types/openapi-internal/RiskClassificationConfigApproval'
import { getContext } from '@/core/utils/context-storage'
import { FLAGRIGHT_SYSTEM_USER } from '@/utils/user'
import { WorkflowRef } from '@/@types/openapi-internal/WorkflowRef'
import { RiskLevelApprovalWorkflow } from '@/@types/openapi-internal/RiskLevelApprovalWorkflow'
import { RiskFactorApproval } from '@/@types/openapi-internal/RiskFactorApproval'
import { RiskFactorsApprovalWorkflow } from '@/@types/openapi-internal/RiskFactorsApprovalWorkflow'
import { RiskClassificationApprovalRequestActionEnum } from '@/@types/openapi-internal/RiskClassificationApprovalRequest'
import { RiskFactorLogic } from '@/@types/openapi-internal/RiskFactorLogic'
import { LogicEntityVariableInUse } from '@/@types/openapi-internal/LogicEntityVariableInUse'
import { LogicAggregationVariable } from '@/@types/openapi-internal/LogicAggregationVariable'

export const RISK_LEVEL_CONSTANT = 'RLV'
export const RISK_FACTORS_VERSION_CONSTANT = 'RFV'

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
  RiskClassificationConfig,
  RiskClassificationConfig,
  RiskClassificationConfig
>

type RiskClassificationApprovalAuditLogReturnData = AuditLogReturnData<
  RiskClassificationConfigApproval,
  RiskClassificationConfigApproval,
  RiskClassificationConfigApproval
>

type DrsRiskItemAuditLogReturnData = AuditLogReturnData<
  DrsScore,
  DrsScore,
  DrsScore
>

type RiskFactorApprovalAuditLogReturnData = AuditLogReturnData<
  RiskFactorApproval,
  RiskFactorApproval,
  RiskFactorApproval
>

@traceable
export class RiskService {
  tenantId: string
  dynamoDb: DynamoDBDocumentClient
  riskRepository: RiskRepository
  mongoDb: MongoClient
  workflowService: WorkflowService

  constructor(
    tenantId: string,
    connections: { dynamoDb: DynamoDBDocumentClient; mongoDb: MongoClient }
  ) {
    this.tenantId = tenantId
    this.dynamoDb = connections.dynamoDb
    this.riskRepository = new RiskRepository(tenantId, connections)
    this.mongoDb = connections.mongoDb
    this.workflowService = new WorkflowService(tenantId, connections)
  }

  async getRiskClassificationItem() {
    const DEFAULT_VALUES: RiskClassificationConfig = {
      classificationValues: DEFAULT_CLASSIFICATION_SETTINGS,
      updatedAt: Date.now(),
      createdAt: Date.now(),
      id: '',
    }

    return (
      (await this.riskRepository.getRiskClassificationItem()) || DEFAULT_VALUES
    )
  }

  @auditLog('RISK_SCORING', 'RISK_CLASSIFICATION', 'UPDATE')
  async createOrUpdateRiskClassificationConfig(
    riskClassificationValues: RiskClassificationScore[],
    comment: string
  ): Promise<RiskClassificationAuditLogReturnData> {
    validateClassificationRequest(riskClassificationValues)

    const oldClassificationValues =
      await this.riskRepository.getRiskClassificationItem()

    const versionService = new VersionHistoryService(this.tenantId, {
      mongoDb: this.mongoDb,
      dynamoDb: this.dynamoDb,
    })

    const versionHistory = await versionService.createVersionHistory(
      'RiskClassification',
      riskClassificationValues,
      comment
    )

    const result =
      await this.riskRepository.createOrUpdateRiskClassificationConfig(
        versionHistory.id,
        riskClassificationValues
      )

    return {
      entities: [
        {
          oldImage: oldClassificationValues,
          newImage: result,
          entityId: 'RISK_CLASSIFICATION_VALUES',
        },
      ],
      result: result,
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

  @auditLog('RISK_SCORING', 'DRS_RISK_LEVEL', 'UPDATE')
  async updateRiskAssignmentLock(
    userId: string,
    isUpdatable: boolean
  ): Promise<DrsRiskItemAuditLogReturnData> {
    console.log(
      `updateRiskAssignmentLock called for user ${userId} with isUpdatable=${isUpdatable}`
    )

    const oldDrsRiskItem = await this.riskRepository.getDRSRiskItem(userId)
    console.log(`Found existing risk item:`, oldDrsRiskItem ? 'yes' : 'no')

    if (!oldDrsRiskItem) {
      throw new BadRequest(
        'No risk assignment found for user. Please create a risk assignment first.'
      )
    }

    console.log(`Current risk item:`, {
      userId: oldDrsRiskItem.userId,
      drsScore: oldDrsRiskItem.drsScore,
      isUpdatable: oldDrsRiskItem.isUpdatable,
      transactionId: oldDrsRiskItem.transactionId,
    })

    // Update only the isUpdatable field atomically
    const newDrsRiskItem = await this.riskRepository.updateRiskAssignmentLock(
      userId,
      isUpdatable
    )

    console.log(`Updated risk item:`, {
      userId: newDrsRiskItem.userId,
      drsScore: newDrsRiskItem.drsScore,
      isUpdatable: newDrsRiskItem.isUpdatable,
      transactionId: newDrsRiskItem.transactionId,
    })

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
    await this.updateRiskFactors(riskFactors, 'Bulk create risk factors')
  }

  @auditLog('RISK_FACTOR', 'RISK_FACTOR_V8', 'UPDATE')
  async bulkUpdateRiskFactors(
    riskFactors: RiskFactor[],
    comment: string
  ): Promise<AuditLogReturnData<RiskFactor, RiskFactor, RiskFactor>> {
    const allRiskFactors = await this.riskRepository.getAllRiskFactors()
    const now = Date.now()

    const v2factors = riskFactors.filter((rf) => rf.parameter)
    const riskClassificationValues =
      await this.riskRepository.getRiskClassificationValues()
    const v2factorsMigrated = v2factors.map((rf) => {
      const migratedFactor = createMigratedFactor(rf, riskClassificationValues)
      return {
        ...rf,
        ...migratedFactor,
      }
    })

    v2factorsMigrated.forEach((migrated) => {
      const idx = riskFactors.findIndex((rf) => rf.id === migrated.id)
      if (idx !== -1) {
        riskFactors[idx] = { ...riskFactors[idx], ...migrated }
      }
    })

    const allUpdatedRiskFactors = allRiskFactors.map((riskFactor) => {
      const newRiskFactor = riskFactors.find((rf) => rf.id === riskFactor.id)
      return {
        ...riskFactor,
        ...newRiskFactor,
      }
    })

    const versionService = new VersionHistoryService(this.tenantId, {
      mongoDb: this.mongoDb,
      dynamoDb: this.dynamoDb,
    })

    const versionHistory = await versionService.createVersionHistory(
      'RiskFactors',
      allUpdatedRiskFactors,
      comment
    )

    const updatedRiskFactors = await this.riskRepository.bulkUpdateRiskFactors(
      riskFactors.map((riskFactor) => ({
        ...riskFactor,
        versionId: versionHistory.id,
      }))
    )

    await Promise.all(
      updatedRiskFactors.map((riskFactor) =>
        riskFactorAggregationVariablesRebuild(
          riskFactor,
          now,
          this.tenantId,
          this.riskRepository
        )
      )
    )

    // Clear cache
    this.riskRepository.getAllRiskFactors.cache.clear?.()

    // Prepare audit log data
    const auditLogData: AuditLogReturnData<RiskFactor, RiskFactor, RiskFactor> =
      {
        entities: updatedRiskFactors.map((riskFactor) => {
          return {
            entityId: riskFactor.id,
            newImage: riskFactor,
            oldImage:
              allRiskFactors.find((rf) => rf.id === riskFactor.id) || undefined,
          }
        }),
        result: updatedRiskFactors[0] ?? null, // Return first updated factor as result
        actionTypeOverride: 'UPDATE',
      }

    return auditLogData
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

  private async getRiskFactorId(
    riskFactor: RiskFactorsUpdate,
    riskFactorId?: string
  ) {
    if (riskFactorId && !riskFactor.riskFactorId) {
      return riskFactorId
    }
    if (riskFactorId || riskFactor.riskFactorId) {
      return await this.getNewRiskFactorId(riskFactor.riskFactorId, true)
    }
    return await this.getNewRiskFactorId(undefined, true)
  }

  @auditLog('RISK_FACTOR', 'RISK_FACTOR_V8', 'UPDATE')
  async updateRiskFactors(
    riskFactors: RiskFactorsUpdate[],
    comment: string
  ): Promise<AuditLogReturnData<void, RiskFactor, RiskFactor>> {
    const versionService = new VersionHistoryService(this.tenantId, {
      mongoDb: this.mongoDb,
      dynamoDb: this.dynamoDb,
    })
    const now = Date.now()
    const [allRiskFactors, riskClassificationValues] = await Promise.all([
      this.riskRepository.getAllRiskFactors(),
      this.riskRepository.getRiskClassificationValues(),
    ])

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

    const riskFactorData: RiskFactor[] = []

    for (const riskFactor of riskFactors) {
      const id = await this.getRiskFactorId(riskFactor)
      const currentRiskFactor = await this.riskRepository.getRiskFactor(id)
      const isDefaultFactor =
        isDefaultRiskFactor(riskFactor) ||
        (currentRiskFactor && isDefaultRiskFactor(currentRiskFactor))
      let migratedFactor: Partial<RiskFactor> | null = null
      if (isDefaultFactor) {
        migratedFactor = createMigratedFactor(
          { ...currentRiskFactor, ...riskFactor },
          riskClassificationValues
        )
      }

      const data: RiskFactor = {
        ...(currentRiskFactor ?? DEFAULT_VALUES),
        ...(isDefaultFactor ? migratedFactor : riskFactor),
        id,
        createdAt: currentRiskFactor?.createdAt ?? now,
        updatedAt: now,
      }
      riskFactorData.push(data)
    }

    const versionHistory = await versionService.createVersionHistory(
      'RiskFactors',
      riskFactorData,
      comment
    )

    const updatedRiskFactors = await this.riskRepository.bulkUpdateRiskFactors(
      riskFactorData.map((riskFactor) => ({
        ...riskFactor,
        versionId: versionHistory.id,
      }))
    )

    await Promise.all(
      riskFactorData.map((riskFactor) =>
        riskFactorAggregationVariablesRebuild(
          riskFactor,
          now,
          this.tenantId,
          this.riskRepository
        )
      )
    )

    this.riskRepository.getAllRiskFactors.cache.clear?.()

    return {
      entities: updatedRiskFactors.map((riskFactor) => ({
        entityId: riskFactor.id,
        newImage: riskFactor,
        oldImage:
          allRiskFactors.find((rf) => rf.id === riskFactor.id) || undefined,
      })),
      result: undefined,
    }
  }

  @auditLog('RISK_FACTOR', 'RISK_FACTOR_V8', 'CREATE')
  async createOrUpdateRiskFactor(
    riskFactor: RiskFactorsUpdate,
    riskFactorId?: string
  ): Promise<AuditLogReturnData<RiskFactor, RiskFactor, RiskFactor>> {
    if (!this.mongoDb) {
      throw new Error('MongoDB connection not available')
    }
    let currentRiskFactor: RiskFactor | null = null
    const isNewRiskFactor = riskFactorId ? false : true
    const id = await this.getRiskFactorId(riskFactor, riskFactorId)
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

    const versionService = new VersionHistoryService(this.tenantId, {
      mongoDb: this.mongoDb,
      dynamoDb: this.dynamoDb,
    })

    const data: RiskFactor = {
      ...(currentRiskFactor ?? DEFAULT_VALUES),
      ...(isDefaultFactor ? migratedFactor : riskFactor),
      id,
      createdAt: currentRiskFactor?.createdAt ?? now,
      updatedAt: now,
    }

    const allRiskFactors = await this.riskRepository.getAllRiskFactors()

    const versionData = await versionService.createVersionHistory(
      'RiskFactors',
      [...allRiskFactors, data],
      `New Risk Factor created: ${data.name}`
    )

    const oldRiskFactor = await this.riskRepository.getRiskFactor(id)

    const updatedData = await this.riskRepository.createOrUpdateRiskFactor({
      ...data,
      versionId: versionData.id,
    })

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

  async getRiskFactorLogic(
    riskFactorId: string,
    versionId: string,
    riskLevel: RiskLevel
  ): Promise<{
    riskFactorLogic: RiskFactorLogic
    riskFactorEntityVariables: Array<LogicEntityVariableInUse>
    riskFactorAggregationVariables: Array<LogicAggregationVariable>
  }> {
    return await this.riskRepository.getRiskFactorLogic(
      riskFactorId,
      versionId,
      riskLevel
    )
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

  /**
   * Proposes a change to risk levels (creates a pending approval)
   */
  // TODO: fix logging
  @auditLog('RISK_SCORING', 'RISK_CLASSIFICATION_PROPOSAL', 'CREATE')
  async workflowProposeRiskLevelChange(
    riskClassificationValues: RiskClassificationScore[],
    comment: string
  ): Promise<RiskClassificationApprovalAuditLogReturnData> {
    validateClassificationRequest(riskClassificationValues)

    // Check if there's already a pending approval that can't be overwritten
    const existingPending =
      await this.riskRepository.getPendingRiskClassificationConfig()
    if (existingPending && existingPending.approvalStatus === 'PENDING') {
      throw new BadRequest(
        'There is already a pending risk level change. Please approve or reject the current proposal first.'
      )
    }

    // fetch the workflow definition
    const workflowDefinition = await this.workflowService.getWorkflow(
      'risk-levels-approval',
      '_default'
    )

    if (!workflowDefinition) {
      throw new BadRequest('Risk level approval workflow not found')
    }

    const workflowRef: WorkflowRef = {
      id: workflowDefinition.id,
      version: workflowDefinition.version,
    }

    // Create the risk classification config
    const counterRepository = new CounterRepository(this.tenantId, {
      mongoDb: this.mongoDb,
      dynamoDb: this.dynamoDb,
    })

    const counter = await counterRepository.getNextCounterAndUpdate('RiskLevel')
    const id = `RLV-${padStart(counter.toString(), 3, '0')}`

    const riskClassificationConfig: RiskClassificationConfig = {
      id,
      classificationValues: riskClassificationValues,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }

    // Create the approval object
    const approval: RiskClassificationConfigApproval = {
      riskClassificationConfig,
      comment,
      workflowRef,
      approvalStatus: 'PENDING',
      approvalStep: 0,
      createdAt: Date.now(),
      createdBy: getContext()?.user?.id ?? FLAGRIGHT_SYSTEM_USER,
    }

    // Store the pending approval
    await this.riskRepository.setPendingRiskClassificationConfig(approval)

    return {
      entities: [
        {
          newImage: approval,
          entityId: 'RISK_CLASSIFICATION_APPROVAL',
        },
      ],
      result: approval,
    }
  }

  /**
   * Approves, rejects, or cancels a change to risk levels
   * @param action Either 'accept', 'reject', or 'cancel'
   */
  @auditLog('RISK_SCORING', 'RISK_CLASSIFICATION_PROPOSAL', 'UPDATE')
  async workflowApproveRiskLevelChange(
    action: RiskClassificationApprovalRequestActionEnum
  ): Promise<RiskClassificationApprovalAuditLogReturnData> {
    const pendingApproval =
      await this.riskRepository.getPendingRiskClassificationConfig()
    // validate action
    if (action !== 'accept' && action !== 'reject' && action !== 'cancel') {
      throw new BadRequest('Invalid action')
    }

    // validate pending approval
    if (!pendingApproval) {
      throw new BadRequest('No pending risk classification approval found')
    }

    if (pendingApproval.approvalStatus === 'APPROVED') {
      // should not happen, we always delete the approval object after approval
      await this.riskRepository.deletePendingRiskClassificationConfig()
      throw new BadRequest('Risk level change has already been approved')
    }

    if (pendingApproval.approvalStatus === 'REJECTED') {
      // should not happen, we always delete the approval object after rejection
      await this.riskRepository.deletePendingRiskClassificationConfig()
      throw new BadRequest('Risk level change has already been rejected')
    }

    // Handle cancel action - only the author can cancel at step 0
    if (action === 'cancel') {
      const currentUserId = getContext()?.user?.id
      if (!currentUserId) {
        throw new BadRequest('User context not available')
      }

      // Only the author can cancel the proposal
      if (pendingApproval.createdBy !== currentUserId) {
        throw new BadRequest('Only the author can cancel the proposal')
      }

      // Only allow cancellation at step 0 (first step)
      if (pendingApproval.approvalStep !== 0) {
        throw new BadRequest('Can only cancel at the first step of approval')
      }

      // Delete the approval object from database
      await this.riskRepository.deletePendingRiskClassificationConfig()

      return {
        entities: [
          {
            oldImage: pendingApproval,
            newImage: { ...pendingApproval, approvalStatus: 'CANCELLED' },
            entityId: 'RISK_CLASSIFICATION_APPROVAL',
          },
        ],
        result: { ...pendingApproval, approvalStatus: 'CANCELLED' },
      }
    }

    // fetch the workflow definition
    const wRef = pendingApproval.workflowRef
    if (!wRef) {
      throw new BadRequest('No workflow reference found')
    }
    // TODO: make types uniform and get rid of toString() cast
    const workflow = await this.workflowService.getWorkflowVersion(
      'risk-levels-approval',
      wRef.id,
      wRef.version.toString()
    )
    const workflowMachine = new RiskLevelApprovalWorkflowMachine(
      workflow as RiskLevelApprovalWorkflow
    )

    // ensure the user performing the action has the role referenced in the current step of the workflow
    const currentStep = workflowMachine.getApprovalStep(
      pendingApproval.approvalStep
    )
    if (currentStep.role !== getContext()?.user?.role) {
      // TODO: keeping this check disabled in backend for now
      // throw new BadRequest('User does not have the role required to perform this action')
    }

    if (action === 'reject') {
      // Delete the approval object from database
      await this.riskRepository.deletePendingRiskClassificationConfig()

      return {
        entities: [
          {
            oldImage: pendingApproval,
            newImage: { ...pendingApproval, approvalStatus: 'REJECTED' },
            entityId: 'RISK_CLASSIFICATION_APPROVAL',
          },
        ],
        result: { ...pendingApproval, approvalStatus: 'REJECTED' },
      }
    }

    // Handle accept action - last step
    if (currentStep.isLastStep) {
      // Get the old risk classification values before updating
      const oldClassificationValues = await this.getRiskClassificationItem()

      // Update the risk classification config
      const result = await this.createOrUpdateRiskClassificationConfig(
        pendingApproval.riskClassificationConfig.classificationValues,
        pendingApproval.comment
      )

      // Manually publish audit log for risk classification update
      const auditLog: AuditLog = {
        type: 'RISK_SCORING',
        subtype: 'RISK_CLASSIFICATION',
        action: 'UPDATE',
        timestamp: Date.now(),
        oldImage: oldClassificationValues,
        newImage: result,
        entityId: 'RISK_CLASSIFICATION_VALUES',
      }
      await publishAuditLog(this.tenantId, auditLog)

      // Delete the approval object from database
      await this.riskRepository.deletePendingRiskClassificationConfig()

      return {
        entities: [
          {
            oldImage: pendingApproval,
            newImage: { ...pendingApproval, approvalStatus: 'APPROVED' },
            entityId: 'RISK_CLASSIFICATION_APPROVAL',
          },
        ],
        result: { ...pendingApproval, approvalStatus: 'APPROVED' },
      }
    }

    // Handle accept action - not last step
    // Update the approval object with the next step
    await this.riskRepository.setPendingRiskClassificationConfig({
      ...pendingApproval,
      approvalStep: pendingApproval.approvalStep + 1,
    })

    // NOTE: Notifications for approval are handled by the audit log consumer

    return {
      entities: [
        {
          oldImage: pendingApproval,
          newImage: { ...pendingApproval, approvalStatus: 'PENDING' },
          entityId: 'RISK_CLASSIFICATION_APPROVAL',
        },
      ],
      result: { ...pendingApproval, approvalStatus: 'PENDING' },
    }
  }

  /**
   * Gets the pending risk level change approval if it exists
   */
  async workflowGetPendingRiskLevelChange(): Promise<RiskClassificationConfigApproval | null> {
    const pendingApproval =
      await this.riskRepository.getPendingRiskClassificationConfig()

    if (!pendingApproval) {
      return null
    }

    return pendingApproval
  }

  /**
   * Proposes a change to risk factors (creates a pending approval)
   */
  // This method is used to propose a change to a risk factor
  // It can be used to CREATE, UPDATE or DELETE a risk factor
  @auditLog('RISK_FACTOR', 'RISK_FACTOR_PROPOSAL', 'CREATE')
  async workflowProposeRiskFactorChange(
    riskFactor: RiskFactorsPostRequest,
    action: 'create' | 'update' | 'delete',
    comment: string
  ): Promise<RiskFactorApprovalAuditLogReturnData> {
    // fetch the workflow definition
    const workflowDefinition = await this.workflowService.getWorkflow(
      'risk-factors-approval',
      '_default'
    )
    if (!workflowDefinition) {
      throw new BadRequest('Risk factors approval workflow not found')
    }
    const workflowRef: WorkflowRef = {
      id: workflowDefinition.id,
      version: workflowDefinition.version,
    }

    // validate the request and set variables for the approval object
    let riskFactorId: string
    let existingRiskFactor: RiskFactor | null = null

    if (action === 'delete') {
      if (!riskFactor.riskFactorId) {
        throw new BadRequest(
          'riskFactorId must be provided when action is delete'
        )
      }

      riskFactorId = riskFactor.riskFactorId

      // check that the risk factor exists
      existingRiskFactor = await this.riskRepository.getRiskFactor(riskFactorId)
      if (!existingRiskFactor) {
        throw new BadRequest(`Risk factor ${riskFactor.riskFactorId} not found`)
      }

      // check that the risk factor is not already pending approval
      const existingPending = await this.riskRepository.getPendingRiskFactor(
        riskFactorId
      )
      if (existingPending && existingPending.approvalStatus === 'PENDING') {
        throw new BadRequest(
          `There is already a pending risk factor change for ${riskFactorId}. Please approve or reject the current proposal first.`
        )
      }
    } else if (action === 'create') {
      // ensure no risk factor id is provided
      if (riskFactor.riskFactorId) {
        throw new BadRequest(
          'riskFactorId must not be provided when action is create'
        )
      }

      // create a new risk factor id
      riskFactorId = await this.getNewRiskFactorId(undefined, true)
    } else if (action === 'update') {
      // ensure a risk factor id is provided
      if (!riskFactor.riskFactorId) {
        throw new BadRequest(
          'riskFactorId must be provided when action is update'
        )
      }

      riskFactorId = riskFactor.riskFactorId

      // check that the risk factor exists
      existingRiskFactor = await this.riskRepository.getRiskFactor(
        riskFactor.riskFactorId
      )
      if (!existingRiskFactor) {
        throw new BadRequest(`Risk factor ${riskFactor.riskFactorId} not found`)
      }

      // check that the risk factor is not already pending approval
      const existingPending = await this.riskRepository.getPendingRiskFactor(
        riskFactor.riskFactorId
      )
      if (existingPending && existingPending.approvalStatus === 'PENDING') {
        throw new BadRequest(
          `There is already a pending risk factor change for ${riskFactor.riskFactorId}. Please approve or reject the current proposal first.`
        )
      }
    } else {
      throw new BadRequest('Invalid action')
    }

    const riskFactorConfig: RiskFactor = {
      ...riskFactor,
      id: riskFactorId,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }

    // Create the approval object
    const approval: RiskFactorApproval = {
      action,
      riskFactor: riskFactorConfig,
      comment,
      workflowRef,
      approvalStatus: 'PENDING',
      approvalStep: 0,
      createdAt: Date.now(),
      createdBy: getContext()?.user?.id ?? FLAGRIGHT_SYSTEM_USER,
    }

    // Store the pending approval
    // NOTE: if a previous approval exists, it will be overwritten
    // (we check above to ensure that there is no PENDING approval)
    await this.riskRepository.setPendingRiskFactorsConfig(
      riskFactorId,
      approval
    )

    return {
      entities: [
        {
          newImage: approval,
          entityId: 'RISK_FACTORS_APPROVAL',
        },
      ],
      result: approval,
    }
  }

  /**
   * Approves, rejects, or cancels a change to risk factors
   * @param action Either 'accept', 'reject', or 'cancel'
   */
  @auditLog('RISK_FACTOR', 'RISK_FACTOR_PROPOSAL', 'UPDATE')
  async workflowApproveRiskFactorChange(
    riskFactorId: string,
    action: 'accept' | 'reject' | 'cancel'
  ): Promise<RiskFactorApprovalAuditLogReturnData> {
    const pendingApproval = await this.riskRepository.getPendingRiskFactor(
      riskFactorId
    )
    // validate action
    if (action !== 'accept' && action !== 'reject' && action !== 'cancel') {
      throw new BadRequest('Invalid action')
    }

    // validate pending approval
    if (!pendingApproval) {
      throw new BadRequest(
        `No pending risk factor approval found for ${riskFactorId}`
      )
    }

    if (pendingApproval.approvalStatus === 'APPROVED') {
      // should not happen, we always delete the approval object after approval
      await this.riskRepository.deletePendingRiskFactorConfig(riskFactorId)
      throw new BadRequest(
        `Risk factor ${riskFactorId} change has already been approved`
      )
    }

    if (pendingApproval.approvalStatus === 'REJECTED') {
      // should not happen, we always delete the approval object after rejection
      await this.riskRepository.deletePendingRiskFactorConfig(riskFactorId)
      throw new BadRequest(
        `Risk factor ${riskFactorId} change has already been rejected`
      )
    }

    // Handle cancel action - only the author can cancel at step 0
    if (action === 'cancel') {
      const currentUserId = getContext()?.user?.id
      if (!currentUserId) {
        throw new BadRequest('User context not available')
      }

      // Only the author can cancel the proposal
      if (pendingApproval.createdBy !== currentUserId) {
        throw new BadRequest('Only the author can cancel the proposal')
      }

      // Only allow cancellation at step 0 (first step)
      if (pendingApproval.approvalStep !== 0) {
        throw new BadRequest('Can only cancel at the first step of approval')
      }

      // Delete the approval object from database
      await this.riskRepository.deletePendingRiskFactorConfig(riskFactorId)

      return {
        entities: [
          {
            oldImage: pendingApproval,
            newImage: { ...pendingApproval, approvalStatus: 'CANCELLED' },
            entityId: 'RISK_FACTORS_APPROVAL',
          },
        ],
        result: { ...pendingApproval, approvalStatus: 'CANCELLED' },
      }
    }

    // fetch the workflow definition
    const wRef = pendingApproval.workflowRef
    if (!wRef) {
      throw new BadRequest('No workflow reference found')
    }
    // TODO: make types uniform and get rid of toString() cast
    const workflow = await this.workflowService.getWorkflowVersion(
      'risk-factors-approval',
      wRef.id,
      wRef.version.toString()
    )
    const workflowMachine = new RiskFactorsApprovalWorkflowMachine(
      workflow as RiskFactorsApprovalWorkflow
    )

    // ensure the user performing the action has the role referenced in the current step of the workflow
    const currentStep = workflowMachine.getApprovalStep(
      pendingApproval.approvalStep as number
    )
    if (currentStep.role !== getContext()?.user?.role) {
      // TODO: keeping this check disabled in backend for now
      // throw new BadRequest('User does not have the role required to perform this action')
    }

    if (action === 'reject') {
      // Delete the approval object from database
      await this.riskRepository.deletePendingRiskFactorConfig(riskFactorId)

      return {
        entities: [
          {
            oldImage: pendingApproval,
            newImage: { ...pendingApproval, approvalStatus: 'REJECTED' },
            entityId: 'RISK_FACTORS_APPROVAL',
          },
        ],
        result: { ...pendingApproval, approvalStatus: 'REJECTED' },
      }
    }

    // Handle accept action - last step
    if (currentStep.isLastStep) {
      const riskFactorId = pendingApproval.riskFactor.id
      // perform the appropriate update operation based on the action
      if (pendingApproval.action === 'delete') {
        await this.deleteRiskFactor(riskFactorId)
      } else if (
        pendingApproval.action === 'create' ||
        pendingApproval.action === 'update'
      ) {
        await this.createOrUpdateRiskFactor(
          pendingApproval.riskFactor,
          riskFactorId
        )
      } else {
        throw new BadRequest('Invalid action')
      }

      // Delete the approval object from database
      await this.riskRepository.deletePendingRiskFactorConfig(riskFactorId)

      return {
        entities: [
          {
            oldImage: pendingApproval,
            newImage: { ...pendingApproval, approvalStatus: 'APPROVED' },
            entityId: 'RISK_FACTORS_APPROVAL',
          },
        ],
        result: { ...pendingApproval, approvalStatus: 'APPROVED' },
      }
    }

    // Handle accept action - not last step
    // Update the approval object with the next step
    await this.riskRepository.setPendingRiskFactorsConfig(riskFactorId, {
      ...pendingApproval,
      approvalStep: (pendingApproval.approvalStep as number) + 1,
    })

    // NOTE: Notifications for approval are handled by the audit log consumer

    return {
      entities: [
        {
          oldImage: pendingApproval,
          newImage: { ...pendingApproval, approvalStatus: 'PENDING' },
          entityId: 'RISK_FACTORS_APPROVAL',
        },
      ],
      result: { ...pendingApproval, approvalStatus: 'PENDING' },
    }
  }

  /**
   * Gets the pending risk factors change approval if it exists
   */
  async workflowGetPendingRiskFactorProposal(
    riskFactorId: string
  ): Promise<RiskFactorApproval | null> {
    const pendingApproval = await this.riskRepository.getPendingRiskFactor(
      riskFactorId
    )

    if (!pendingApproval) {
      return null
    }

    return pendingApproval
  }

  async workflowGetPendingRiskFactorProposals(): Promise<RiskFactorApproval[]> {
    const pendingApprovals = await this.riskRepository.getPendingRiskFactors()
    return pendingApprovals
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
  riskFactor: RiskFactorsUpdate,
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
