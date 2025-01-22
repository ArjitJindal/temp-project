import { MongoClient } from 'mongodb'
import { NotFound, BadRequest } from 'http-errors'
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb'
import { AlertsRepository } from '../alerts/repository'
import { RuleInstanceRepository } from '../rules-engine/repositories/rule-instance-repository'
import { RuleQueuesRepository } from './repositories/rule-queues-repository'
import { traceable } from '@/core/xray'
import { DefaultApiGetRuleQueuesRequest } from '@/@types/openapi-internal/RequestParameters'
import { RuleQueue } from '@/@types/openapi-internal/RuleQueue'

export type RuleQueueWithId = RuleQueue & { id: string }

@traceable
export class RuleQueuesService {
  tenantId: string
  ruleQueueRepository: RuleQueuesRepository
  mongoDb: MongoClient
  ruleInstanceRepository: RuleInstanceRepository

  constructor(
    tenantId: string,
    connections: { mongoDb: MongoClient; dynamoDb: DynamoDBDocumentClient }
  ) {
    this.tenantId = tenantId
    this.ruleQueueRepository = new RuleQueuesRepository(
      tenantId,
      connections.mongoDb
    )
    this.mongoDb = connections.mongoDb
    this.ruleInstanceRepository = new RuleInstanceRepository(
      tenantId,
      connections
    )
  }

  public async getRuleQueue(RuleQueueId: string) {
    return this.ruleQueueRepository.getRuleQueue(RuleQueueId)
  }

  public async getRuleQueues(params: DefaultApiGetRuleQueuesRequest) {
    return this.ruleQueueRepository.getRuleQueues(params)
  }
  public async createRuleQueue(queue: RuleQueue) {
    if (queue.id && (await this.ruleQueueRepository.getRuleQueue(queue.id))) {
      throw new BadRequest(`Rule queue ${queue.id} already exists`)
    }
    const now = Date.now()
    return this.ruleQueueRepository.createOrUpdateRuleQueue({
      ...queue,
      createdAt: now,
      updatedAt: now,
    })
  }

  public async updateRuleQueue(queue: RuleQueueWithId) {
    const existingQueue = await this.ruleQueueRepository.getRuleQueue(queue.id)
    if (!existingQueue) {
      throw new NotFound(`Rule queue ${queue.id}  not found`)
    }
    return this.ruleQueueRepository.createOrUpdateRuleQueue({
      ...queue,
      createdAt: existingQueue.createdAt,
      updatedAt: Date.now(),
    })
  }
  public async deleteQueue(queueId: string) {
    if (!(await this.ruleQueueRepository.getRuleQueue(queueId))) {
      throw new NotFound(`Rule queue ${queueId}  not found`)
    }
    const alertsRepository = new AlertsRepository(this.tenantId, {
      mongoDb: this.mongoDb,
      dynamoDb: this.ruleInstanceRepository.dynamoDb,
    })

    await this.ruleInstanceRepository.deleteRuleQueue(queueId)
    await alertsRepository.deleteRuleQueue(queueId)

    return this.ruleQueueRepository.deleteRuleQueue(queueId)
  }
}
