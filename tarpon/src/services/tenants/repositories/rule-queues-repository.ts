import { MongoClient, AggregationCursor } from 'mongodb'

import { isNil, omitBy } from 'lodash'
import { shortId } from '@flagright/lib/utils'
import {
  paginatePipeline,
  prefixRegexMatchFilter,
  regexMatchFilter,
} from '@/utils/mongodb-utils'
import { RULE_QUEUES_COLLECTION } from '@/utils/mongodb-definitions'
import { traceable } from '@/core/xray'
import { RuleQueue } from '@/@types/openapi-internal/RuleQueue'
import { DefaultApiGetRuleQueuesRequest } from '@/@types/openapi-internal/RequestParameters'

@traceable
export class RuleQueuesRepository {
  tenantId: string
  mongoDb: MongoClient

  constructor(tenantId: string, mongoDb: MongoClient) {
    this.tenantId = tenantId
    this.mongoDb = mongoDb
  }

  public async getRuleQueues(
    params: DefaultApiGetRuleQueuesRequest
  ): Promise<{ total: number; data: RuleQueue[] }> {
    const cursor = this.getRuleQueuesCursor(params)
    const total = await this.getRuleQueuesCount()
    return { total, data: await cursor.toArray() }
  }

  public async getRuleQueue(ruleQueueId: string): Promise<RuleQueue | null> {
    const db = this.mongoDb.db()
    const collection = db.collection<RuleQueue>(
      RULE_QUEUES_COLLECTION(this.tenantId)
    )
    return await collection.findOne({ id: ruleQueueId })
  }

  public async createOrUpdateRuleQueue(queue: RuleQueue): Promise<RuleQueue> {
    const db = this.mongoDb.db()
    const collection = db.collection<RuleQueue>(
      RULE_QUEUES_COLLECTION(this.tenantId)
    )
    const queueId = queue.id ?? shortId()
    queue.id = queueId
    await collection.replaceOne(
      {
        id: queueId,
      },
      queue,
      { upsert: true }
    )
    return queue
  }

  public async deleteRuleQueue(queueId: string): Promise<void> {
    const db = this.mongoDb.db()
    const collection = db.collection<RuleQueue>(
      RULE_QUEUES_COLLECTION(this.tenantId)
    )
    await collection.deleteOne({ id: queueId })
  }

  private getRuleQueuesCount(): Promise<number> {
    const db = this.mongoDb.db()
    const collection = db.collection<RuleQueue>(
      RULE_QUEUES_COLLECTION(this.tenantId)
    )
    return collection.countDocuments()
  }

  public getRuleQueuesCursor(
    params: DefaultApiGetRuleQueuesRequest
  ): AggregationCursor<RuleQueue> {
    const db = this.mongoDb.db()
    const collection = db.collection<RuleQueue>(
      RULE_QUEUES_COLLECTION(this.tenantId)
    )
    const matchStage = [
      omitBy(
        {
          $match: omitBy(
            {
              name: params.filterName
                ? regexMatchFilter(params.filterName, true)
                : undefined,
              id: params.filterId
                ? prefixRegexMatchFilter(params.filterId)
                : undefined,
            },
            isNil
          ),
        },
        isNil
      ),
    ]

    return collection.aggregate<RuleQueue>([
      ...matchStage,
      { $sort: { createdAt: -1 } },
      ...paginatePipeline(params),
    ])
  }
}
