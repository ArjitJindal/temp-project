import { MongoClient } from 'mongodb'
import { NotFound, BadRequest } from 'http-errors'
import { RuleQueuesRepository } from './repositories/rule-queues-repository'
import { traceable } from '@/core/xray'
import { DefaultApiGetRuleQueuesRequest } from '@/@types/openapi-internal/RequestParameters'
import { RuleQueue } from '@/@types/openapi-internal/RuleQueue'

export type RuleQueueWithId = RuleQueue & { id: string }

@traceable
export class RuleQueuesService {
  tenantId: string
  repository: RuleQueuesRepository

  constructor(tenantId: string, mongoDb: MongoClient) {
    this.tenantId = tenantId
    this.repository = new RuleQueuesRepository(tenantId, mongoDb)
  }

  public async getRuleQueue(RuleQueueId: string) {
    return this.repository.getRuleQueue(RuleQueueId)
  }

  public async getRuleQueues(params: DefaultApiGetRuleQueuesRequest) {
    return this.repository.getRuleQueues(params)
  }
  public async createRuleQueue(queue: RuleQueue) {
    if (queue.id && (await this.repository.getRuleQueue(queue.id))) {
      throw new BadRequest(`Rule queue ${queue.id} already exists`)
    }
    const now = Date.now()
    return this.repository.createOrUpdateRuleQueue({
      ...queue,
      createdAt: now,
      updatedAt: now,
    })
  }

  public async updateRuleQueue(queue: RuleQueueWithId) {
    const existingQueue = await this.repository.getRuleQueue(queue.id)
    if (!existingQueue) {
      throw new NotFound(`Rule queue ${queue.id}  not found`)
    }
    return this.repository.createOrUpdateRuleQueue({
      ...queue,
      createdAt: existingQueue.createdAt,
      updatedAt: Date.now(),
    })
  }
  public async deleteRuleQueue(queueId: string) {
    if (!(await this.repository.getRuleQueue(queueId))) {
      throw new NotFound(`Rule queue ${queueId}  not found`)
    }
    return this.repository.deleteRuleQueue(queueId)
  }
}
