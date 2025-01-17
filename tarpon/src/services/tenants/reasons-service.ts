import { MongoClient } from 'mongodb'
import { CounterRepository } from '../counter/repository'
import { ReasonsRepository } from './repositories/reasons-repository'
import { traceable } from '@/core/xray'
import { ConsoleActionReason } from '@/@types/openapi-internal/ConsoleActionReason'
import { ReasonType } from '@/@types/openapi-internal/ReasonType'
import { ConsoleActionReasonCreationRequest } from '@/@types/openapi-internal/ConsoleActionReasonCreationRequest'
import { CaseReasons } from '@/@types/openapi-internal/CaseReasons'

export const DEFAULT_CLOSURE_REASONS: CaseReasons[] = [
  'False positive',
  'Investigation completed',
  'Documents collected',
  'Suspicious activity reported (SAR)',
  'Documents not collected',
  'Transaction Refunded',
  'Transaction Rejected',
  'User Blacklisted',
  'User Terminated',
  'Escalated',
  'Confirmed fraud',
  'Confirmed genuine',
  'Suspected fraud',
  'True positive',
  'Fraud',
  'Anti-money laundering',
  'Terrorist financing',
  'Internal referral',
  'External referral',
  'Other',
]

export const DEFAULT_ESCALATION_REASONS = [
  'Fraud',
  'Anti-money laundering',
  'Terrorist financing',
  'Other',
]

export const getDefaultReasonsData = () => {
  const date = Date.now()
  const defaultClosureReasons: ConsoleActionReason[] =
    DEFAULT_CLOSURE_REASONS.map((reason, index) => ({
      id: 'AR' + (index + 1).toString().padStart(3, '0'),
      reason: reason,
      reasonType: 'CLOSURE',
      updatedAt: date + index,
      isActive: true,
    }))
  const defaultEscalationReasons: ConsoleActionReason[] =
    DEFAULT_ESCALATION_REASONS.map((reason, index) => ({
      id: 'AR' + (index + 1).toString().padStart(3, '0'),
      reason: reason,
      reasonType: 'ESCALATION',
      updatedAt: date + index,
      isActive: true,
    }))
  return defaultClosureReasons.concat(defaultEscalationReasons)
}

@traceable
export class ReasonsService {
  private reasonsRepository: ReasonsRepository
  private counterRepository: CounterRepository
  constructor(tenantId: string, mongoDb: MongoClient) {
    this.reasonsRepository = new ReasonsRepository(tenantId, mongoDb)
    this.counterRepository = new CounterRepository(tenantId, mongoDb)
  }

  private async getNewReasonId(type: ReasonType) {
    const count = await this.counterRepository.getNextCounterAndUpdate(
      type === 'CLOSURE' ? 'ClosureReason' : 'EscalationReason'
    )
    return 'AR' + count.toString().padStart(3, '0')
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
    const reasons: ConsoleActionReason[] = []
    for (const data of request) {
      const id = await this.getNewReasonId(data.reasonType)
      reasons.push({
        ...data,
        id,
        isActive: true,
        updatedAt: updatedAt,
      })
    }
    await this.reasonsRepository.bulkAddReasons(reasons)
    return reasons
  }

  public async initialiseDefaultReasons() {
    const defaultReasons = getDefaultReasonsData()
    return await this.reasonsRepository.bulkAddReasons(defaultReasons)
  }
}
