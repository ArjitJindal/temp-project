import { MongoClient } from 'mongodb'
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb'
import { COUNTER_COLLECTION } from '@/utils/mongo-table-names'
import {
  isClickhouseEnabledInRegion,
  isClickhouseMigrationEnabled,
} from '@/utils/clickhouse/checks'
import { DynamoCounterRepository } from '@/services/counter/dynamo-repository'
import { logger } from '@/core/logger'

export type CounterEntity =
  | 'Case'
  | 'Alert'
  | 'AlertQASample'
  | 'Report'
  | 'RC'
  | 'SanctionsHit'
  | 'CustomRiskFactor'
  | 'SLAPolicy'
  | 'SanctionsWhitelist'
  | 'RiskFactor'
  | 'ClosureReason'
  | 'EscalationReason'
  | 'SearchProfile'
  | 'ScreeningProfile'
  | 'WorkflowCase'
  | 'WorkflowAlert'
  | 'WorkflowChangeApproval'
  | 'RiskLevel'
  | 'ScreeningDetails'
  | 'RiskFactors'

export const COUNTER_ENTITIES: CounterEntity[] = [
  'Case',
  'Alert',
  'AlertQASample',
  'Report',
  'RC',
  'CustomRiskFactor',
  'SLAPolicy',
  'ClosureReason',
  'EscalationReason',
  'SearchProfile',
  'ScreeningProfile',
  'WorkflowCase',
  'WorkflowAlert',
  'WorkflowChangeApproval',
  'RiskLevel',
  'ScreeningDetails',
  'RiskFactors',
]

export type EntityCounter = {
  _id?: string
  entity: CounterEntity
  count: number
}

export class CounterRepository {
  private tenantId: string
  private mongoDb: MongoClient
  private dynamoCounterRepository: DynamoCounterRepository

  constructor(
    tenantId: string,
    connections: { mongoDb: MongoClient; dynamoDb: DynamoDBDocumentClient }
  ) {
    this.tenantId = tenantId
    this.mongoDb = connections.mongoDb
    this.dynamoCounterRepository = new DynamoCounterRepository(
      tenantId,
      connections.dynamoDb
    )
  }

  // If an entity doesn't have a counter yet, we need to initialize it with 0. Otherwise,
  // if multilpe callers call `getNextCounterAndUpdate` concurrently, we could end up with
  // duplicate counters.
  public async initialize(): Promise<void> {
    if (isClickhouseEnabledInRegion()) {
      await this.dynamoCounterRepository.initialize()
    }
    const collectionName = COUNTER_COLLECTION(this.tenantId)
    const db = this.mongoDb.db()
    const collection = db.collection<EntityCounter>(collectionName)
    for (const entity of COUNTER_ENTITIES) {
      if (!(await collection.findOne({ entity }))) {
        await collection.insertOne({ entity, count: 0 })
      }
    }
  }

  public async getNextCounterAndUpdate(entity: CounterEntity): Promise<number> {
    let counter: number | undefined
    if (isClickhouseEnabledInRegion()) {
      counter = await this.dynamoCounterRepository.getNextCounterAndUpdate(
        entity,
        1
      )
    }
    const collectionName = COUNTER_COLLECTION(this.tenantId)
    const db = this.mongoDb.db()
    const collection = db.collection<EntityCounter>(collectionName)

    const data = await collection.findOneAndUpdate(
      { entity },
      { $inc: { count: 1 } },
      { upsert: true, returnDocument: 'after' }
    )
    const mongoCounter = data.value?.count ?? 1
    if (counter && counter !== mongoCounter) {
      const deviation =
        Math.abs(counter - mongoCounter) / Math.max(counter, mongoCounter)
      if (deviation >= 0.1) {
        logger.info(
          `Counter mismatch for getNextCounterAndUpdate: Dynamo=${counter}, Mongo=${mongoCounter}, Entity=${entity}`
        )
      }
    }
    return mongoCounter
  }

  public async getNextCountersAndUpdate(
    entity: CounterEntity,
    count: number
  ): Promise<number[]> {
    if (isClickhouseEnabledInRegion()) {
      await this.dynamoCounterRepository.getNextCountersAndUpdate(entity, count)
    }
    const collectionName = COUNTER_COLLECTION(this.tenantId)
    const db = this.mongoDb.db()
    const collection = db.collection<EntityCounter>(collectionName)

    const data = await collection.findOneAndUpdate(
      { entity },
      { $inc: { count } },
      { upsert: true, returnDocument: 'after' }
    )

    const value = data.value?.count ?? 1
    return [...new Array(count)].map((_, i) => value - i)
  }

  public async getNextCounter(entity: CounterEntity): Promise<number> {
    let counter: number | undefined
    if (isClickhouseMigrationEnabled()) {
      counter = await this.dynamoCounterRepository.getNextCounter(entity)
    }
    const collectionName = COUNTER_COLLECTION(this.tenantId)
    const db = this.mongoDb.db()
    const collection = db.collection<EntityCounter>(collectionName)

    const data = await collection.findOne({ entity })
    const mongoCounter = (data?.count ?? 0) + 1
    if (counter && counter !== mongoCounter) {
      const deviation =
        Math.abs(counter - mongoCounter) / Math.max(counter, mongoCounter)
      if (deviation >= 0.1) {
        logger.info(
          `Counter mismatch for getNextCounter: Dynamo=${counter}, Mongo=${mongoCounter}, Entity=${entity}`
        )
      }
    }
    return (data?.count ?? 0) + 1
  }

  public async setCounterValue(
    entity: CounterEntity,
    count: number
  ): Promise<void> {
    if (isClickhouseEnabledInRegion()) {
      await this.dynamoCounterRepository.setCounterValue(entity, count)
    }
    const collectionName = COUNTER_COLLECTION(this.tenantId)
    const db = this.mongoDb.db()
    const collection = db.collection<EntityCounter>(collectionName)
    await collection.findOneAndUpdate(
      { entity },
      { $set: { count: count } },
      { upsert: true, returnDocument: 'after' }
    )
  }
}
