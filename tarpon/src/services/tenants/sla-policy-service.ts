import { MongoClient } from 'mongodb'
import { SLAPolicyRepository } from './repositories/sla-policy-repository'
import { traceable } from '@/core/xray'
import { SLAPolicy } from '@/@types/openapi-internal/SLAPolicy'
import { DefaultApiGetSlaPoliciesRequest } from '@/@types/openapi-internal/RequestParameters'
import { SLAPoliciesResponse } from '@/@types/openapi-internal/SLAPoliciesResponse'
import { SLAPolicyIdResponse } from '@/@types/openapi-internal/SLAPolicyIdResponse'

@traceable
export class SLAPolicyService {
  private slaPolicyRepository: SLAPolicyRepository
  constructor(tenantId: string, mongoClient: MongoClient) {
    this.slaPolicyRepository = new SLAPolicyRepository(tenantId, mongoClient)
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
    return await this.slaPolicyRepository.createSLAPolicy({
      ...policy,
      id: id,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    })
  }
  public async updateSLAPolicy(policy: SLAPolicy): Promise<SLAPolicy> {
    return await this.slaPolicyRepository.updateSLAPolicy({
      ...policy,
      updatedAt: Date.now(),
    })
  }
  public async deleteSLAPolicy(id: string): Promise<void> {
    return await this.slaPolicyRepository.deleteSLAPolicy(id)
  }

  public async getSLAPolicyId(): Promise<SLAPolicyIdResponse> {
    return { id: await this.slaPolicyRepository.getNewId(false) }
  }
}
