import { MongoClient } from 'mongodb'
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb'
import { SLAAuditLogService } from '../sla/sla-audit-log-service'
import { SLAPolicyRepository } from './repositories/sla-policy-repository'
import { traceable } from '@/core/xray'
import { SLAPolicy } from '@/@types/openapi-internal/SLAPolicy'
import { DefaultApiGetSlaPoliciesRequest } from '@/@types/openapi-internal/RequestParameters'
import { SLAPoliciesResponse } from '@/@types/openapi-internal/SLAPoliciesResponse'
import { SLAPolicyIdResponse } from '@/@types/openapi-internal/SLAPolicyIdResponse'

@traceable
export class SLAPolicyService {
  private slaPolicyRepository: SLAPolicyRepository
  private slaAuditLogService: SLAAuditLogService
  constructor(
    tenantId: string,
    connections: { mongoDb: MongoClient; dynamoDb: DynamoDBDocumentClient }
  ) {
    this.slaPolicyRepository = new SLAPolicyRepository(tenantId, connections)
    this.slaAuditLogService = new SLAAuditLogService(tenantId)
  }
  public async getSLAPolicies(
    params: DefaultApiGetSlaPoliciesRequest
  ): Promise<SLAPoliciesResponse> {
    const data = await this.slaPolicyRepository.getSLAPolicies(params)
    return { total: data.length, items: data }
  }
  public async getSLAPolicyById(id: string): Promise<SLAPolicy | null> {
    return await this.slaPolicyRepository.getSLAPolicyById(id)
  }
  public async createSLAPolicy(policy: SLAPolicy): Promise<SLAPolicy> {
    const id = await this.slaPolicyRepository.getNewId(true)
    const newPolicy = {
      ...policy,
      id: id,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }
    const savedPolicy = await this.slaPolicyRepository.createSLAPolicy(
      newPolicy
    )
    await this.slaAuditLogService.handleAuditLogForSLAPolicyChange(
      id,
      undefined,
      savedPolicy
    )
    return savedPolicy
  }
  public async updateSLAPolicy(policy: SLAPolicy): Promise<SLAPolicy> {
    const oldPolicy = await this.getSLAPolicyById(policy.id)
    const updatedPolicy = {
      ...policy,
      updatedAt: Date.now(),
    }
    const savedPolicy = await this.slaPolicyRepository.updateSLAPolicy(
      updatedPolicy
    )
    await this.slaAuditLogService.handleAuditLogForSLAPolicyChange(
      policy.id,
      oldPolicy,
      savedPolicy
    )
    return savedPolicy
  }
  public async reassignSLAPolicies(
    assignmentId: string,
    reassignToUserId: string
  ): Promise<void> {
    return await this.slaPolicyRepository.reassignSLAPolicies(
      assignmentId,
      reassignToUserId
    )
  }
  public async deleteSLAPolicy(id: string): Promise<void> {
    return await this.slaPolicyRepository.deleteSLAPolicy(id)
  }

  public async getSLAPolicyId(): Promise<SLAPolicyIdResponse> {
    return { id: await this.slaPolicyRepository.getNewId(false) }
  }
}
