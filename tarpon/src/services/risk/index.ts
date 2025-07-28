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
import { RiskLevelApprovalWorkflowMachine } from '@flagright/lib/classes/workflow-machine'
import { createV8FactorFromV2 } from '../risk-scoring/risk-factors'
import { isDefaultRiskFactor } from '../risk-scoring/utils'
import { CounterRepository } from '../counter/repository'
import { WorkflowService } from '../workflow'
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
import { AuditLog } from '@/@types/openapi-internal/AuditLog'
import { publishAuditLog } from '@/services/audit-log'
import { DrsScore } from '@/@types/openapi-internal/DrsScore'
import {
  DefaultApiGetDrsValuesRequest,
  DefaultApiGetRiskLevelVersionHistoryRequest,
} from '@/@types/openapi-internal/RequestParameters'
import { RiskClassificationConfig } from '@/@types/openapi-internal/RiskClassificationConfig'
import { RiskClassificationHistory } from '@/@types/openapi-internal/RiskClassificationHistory'
import { RiskClassificationConfigApproval } from '@/@types/openapi-internal/RiskClassificationConfigApproval'
import { getContext } from '@/core/utils/context-storage'
import { FLAGRIGHT_SYSTEM_USER } from '@/utils/user'
import { WorkflowRef } from '@/@types/openapi-internal/WorkflowRef'
import { RiskLevelApprovalWorkflow } from '@/@types/openapi-internal/RiskLevelApprovalWorkflow'
import { RiskClassificationApprovalRequestActionEnum } from '@/@types/openapi-internal/RiskClassificationApprovalRequest'

export const RISK_LEVEL_CONSTANT = 'RLV'

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
  RiskClassificationHistory,
  RiskClassificationConfig,
  RiskClassificationHistory
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
    this.riskRepository = new RiskRepository(tenantId, {
      dynamoDb: this.dynamoDb,
      mongoDb: connections.mongoDb,
    })
    this.mongoDb = connections.mongoDb
    this.workflowService = new WorkflowService(tenantId, connections)
  }

  async getRiskClassificationItem() {
    return await this.riskRepository.getRiskClassificationItem()
  }

  async getCounterValue() {
    const counterRepository = new CounterRepository(this.tenantId, {
      mongoDb: this.mongoDb,
      dynamoDb: this.dynamoDb,
    })
    return await counterRepository.getNextCounter('RiskLevel')
  }

  public static getRiskLevelId(counter: number) {
    return `${RISK_LEVEL_CONSTANT}-${padStart(counter.toString(), 3, '0')}`
  }

  @auditLog('RISK_SCORING', 'RISK_CLASSIFICATION', 'UPDATE')
  async createOrUpdateRiskClassificationConfig(
    riskClassificationValues: RiskClassificationScore[],
    comment: string
  ): Promise<RiskClassificationAuditLogReturnData> {
    validateClassificationRequest(riskClassificationValues)

    const oldClassificationValues =
      await this.riskRepository.getRiskClassificationItem()

    const counterRepository = new CounterRepository(this.tenantId, {
      mongoDb: this.mongoDb,
      dynamoDb: this.dynamoDb,
    })

    const counter = await counterRepository.getNextCounterAndUpdate('RiskLevel')
    const id = RiskService.getRiskLevelId(counter)

    const result =
      await this.riskRepository.createOrUpdateRiskClassificationConfig(
        id,
        comment,
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

  async getRiskLevelVersionHistory(
    params: DefaultApiGetRiskLevelVersionHistoryRequest
  ): Promise<{ items: RiskClassificationHistory[]; total: number }> {
    const [result, count] = await Promise.all([
      this.riskRepository.getRiskClassificationHistory(params),
      this.riskRepository.getRiskClassificationHistoryCount(params),
    ])
    return {
      items: result,
      total: count,
    }
  }

  async getRiskLevelVersionHistoryById(id: string) {
    return await this.riskRepository.getRiskClassificationHistoryById(id)
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
    const id = RiskService.getRiskLevelId(counter)

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
      const oldClassificationValues =
        await this.riskRepository.getRiskClassificationItem()

      // Update the risk classification config
      const result =
        await this.riskRepository.createOrUpdateRiskClassificationConfig(
          pendingApproval.riskClassificationConfig.id,
          pendingApproval.comment,
          pendingApproval.riskClassificationConfig.classificationValues
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
