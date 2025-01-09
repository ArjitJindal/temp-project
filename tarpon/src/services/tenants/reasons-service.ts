import { MongoClient } from 'mongodb'
import { v4 as uuidv4 } from 'uuid'
import { ReasonsRepository } from './repositories/reasons-repository'
import { traceable } from '@/core/xray'
import { ConsoleActionReason } from '@/@types/openapi-internal/ConsoleActionReason'
import { ReasonType } from '@/@types/openapi-internal/ReasonType'
import { ConsoleActionReasonCreationRequest } from '@/@types/openapi-internal/ConsoleActionReasonCreationRequest'
import { CASE_REASONSS } from '@/@types/openapi-internal-custom/CaseReasons'

export const DEFAULT_CLOSURE_REASONS = CASE_REASONSS.reverse()

export const DEFAULT_ESCALATION_REASONS = [
  'Fraud',
  'Anti-money laundering',
  'Terrorist financing',
  'Other',
]

export const getDefaultReasonsData = () => {
  const date = Date.now()
  const defaultClosureReasons: ConsoleActionReason[] =
    DEFAULT_CLOSURE_REASONS.map((reason) => ({
      id: uuidv4(),
      reason: reason,
      reasonType: 'CLOSURE',
      updatedAt: date,
      isActive: true,
    }))
  const defaultEscalationReasons: ConsoleActionReason[] =
    DEFAULT_ESCALATION_REASONS.map((reason) => ({
      id: uuidv4(),
      reason: reason,
      reasonType: 'ESCALATION',
      updatedAt: date,
      isActive: true,
    }))
  return defaultClosureReasons.concat(defaultEscalationReasons)
}

@traceable
export class ReasonsService {
  private reasonsRepository: ReasonsRepository
  constructor(tenantId: string, mongoDb: MongoClient) {
    this.reasonsRepository = new ReasonsRepository(tenantId, mongoDb)
  }

  public async getReasons(type?: ReasonType) {
    return await this.reasonsRepository.getReasons(type)
  }

  public async enableOrDisableReason(id: string, isActive: boolean) {
    return await this.reasonsRepository.updateReason(id, {
      isActive: isActive,
    })
  }

  public async addReasons(request: ConsoleActionReasonCreationRequest[]) {
    const updatedAt = Date.now()
    const reasons = request.map(
      (data): ConsoleActionReason => ({
        ...data,
        id: uuidv4(),
        isActive: true,
        updatedAt,
      })
    )
    await this.reasonsRepository.bulkAddReasons(reasons)
    return reasons
  }

  public async initialiseDefaultReasons() {
    const defaultReasons = getDefaultReasonsData()
    return await this.reasonsRepository.bulkAddReasons(defaultReasons)
  }
}
