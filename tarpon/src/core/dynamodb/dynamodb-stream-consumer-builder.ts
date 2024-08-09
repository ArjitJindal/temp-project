import { KinesisStreamEvent, SQSEvent } from 'aws-lambda'
import { SendMessageBatchCommand } from '@aws-sdk/client-sqs'
import { SendMessageBatchRequestEntry } from '@aws-sdk/client-sqs/dist-types/models/models_0'
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb'
import { MongoClient } from 'mongodb'
import { groupBy } from 'lodash'
import { TransientRepository } from '../repositories/transient-repository'
import { logger } from '../logger'
import {
  initializeTenantContext,
  tenantHasFeature,
  updateLogMetadata,
  withContext,
} from '../utils/context'
import {
  DynamoDbEntityUpdate,
  getDynamoDbUpdates,
  savePartitionKey,
} from './dynamodb-stream-utils'
import { TransactionWithRulesResult } from '@/@types/openapi-public/TransactionWithRulesResult'
import { User } from '@/@types/openapi-public/User'
import { TransactionEvent } from '@/@types/openapi-public/TransactionEvent'
import { ConsumerUserEvent } from '@/@types/openapi-public/ConsumerUserEvent'
import { BusinessUserEvent } from '@/@types/openapi-public/BusinessUserEvent'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { ArsScore } from '@/@types/openapi-internal/ArsScore'
import { DrsScore } from '@/@types/openapi-internal/DrsScore'
import { KrsScore } from '@/@types/openapi-internal/KrsScore'
import { RuleInstance } from '@/@types/openapi-public-management/RuleInstance'
import { getSQSClient } from '@/utils/sns-sqs-client'
import { envIs } from '@/utils/env'
import { getMongoDbClient } from '@/utils/mongodb-utils'

export type DbClients = {
  dynamoDb: DynamoDBDocumentClient
  mongoDb: MongoClient
}

type TransactionHandler = (
  tenantId: string,
  oldTransaction: TransactionWithRulesResult | undefined,
  newTransaction: TransactionWithRulesResult | undefined,
  dbClients: DbClients
) => Promise<void>
type TransactionEventHandler = (
  tenantId: string,
  oldTransactionEvent: TransactionEvent | undefined,
  newTransactionEvent: TransactionEvent | undefined,
  dbClients: DbClients
) => Promise<void>
type UserHandler = (
  tenantId: string,
  oldUser: User | undefined,
  newUser: User | undefined,
  dbClients: DbClients
) => Promise<void>
type UserEventHandler = (
  tenantId: string,
  oldUserEvent: ConsumerUserEvent | undefined,
  newUserEvent: ConsumerUserEvent | undefined,
  dbClients: DbClients
) => Promise<void>
type ArsScoreEventHandler = (
  tenantId: string,
  oldArsValue: ArsScore | undefined,
  newArsValue: ArsScore | undefined,
  dbClients: DbClients
) => Promise<void>
type DrsScoreEventHandler = (
  tenantId: string,
  oldDrsValue: DrsScore | undefined,
  newDrsValue: DrsScore | undefined,
  dbClients: DbClients
) => Promise<void>
type KrsScoreEventHandler = (
  tenantId: string,
  oldKrsValue: KrsScore | undefined,
  newKrsValue: KrsScore | undefined,
  dbClients: DbClients
) => Promise<void>
type RuleInstanceHandler = (
  tenantId: string,
  oldRuleInstance: RuleInstance | undefined,
  newRuleInstance: RuleInstance | undefined,
  dbClients: DbClients
) => Promise<void>

const sqsClient = getSQSClient()

export class StreamConsumerBuilder {
  name: string
  fanOutSqsQueue: string
  transientRepository: TransientRepository
  tableName: string
  transactionHandler?: TransactionHandler
  transactionEventHandler?: TransactionEventHandler
  userHandler?: UserHandler
  userEventHandler?: UserEventHandler
  arsScoreEventHandler?: ArsScoreEventHandler
  drsScoreEventHandler?: DrsScoreEventHandler
  krsScoreEventHandler?: KrsScoreEventHandler
  ruleInstanceHandler?: RuleInstanceHandler

  constructor(name: string, fanOutSqsQueue: string, tableName: string) {
    this.name = name
    this.fanOutSqsQueue = fanOutSqsQueue
    this.transientRepository = new TransientRepository(getDynamoDbClient())
    this.tableName = tableName
  }

  public setTransactionHandler(
    transactionHandler: TransactionHandler
  ): StreamConsumerBuilder {
    this.transactionHandler = transactionHandler
    return this
  }
  public setTransactionEventHandler(
    transactionEventHandler: TransactionEventHandler
  ): StreamConsumerBuilder {
    this.transactionEventHandler = transactionEventHandler
    return this
  }
  public setUserHandler(userHandler: UserHandler): StreamConsumerBuilder {
    this.userHandler = userHandler
    return this
  }
  public setUserEventHandler(
    userEventHandler: UserEventHandler
  ): StreamConsumerBuilder {
    this.userEventHandler = userEventHandler
    return this
  }
  public setArsScoreEventHandler(
    arsScoreEventHandler: ArsScoreEventHandler
  ): StreamConsumerBuilder {
    this.arsScoreEventHandler = arsScoreEventHandler
    return this
  }
  public setDrsScoreEventHandler(
    drsScoreEventHandler: DrsScoreEventHandler
  ): StreamConsumerBuilder {
    this.drsScoreEventHandler = drsScoreEventHandler
    return this
  }
  public setKrsScoreEventHandler(
    krsScoreEventHandler: KrsScoreEventHandler
  ): StreamConsumerBuilder {
    this.krsScoreEventHandler = krsScoreEventHandler
    return this
  }
  public setRuleInstanceHandler(
    ruleInstanceHandler: RuleInstanceHandler
  ): StreamConsumerBuilder {
    this.ruleInstanceHandler = ruleInstanceHandler
    return this
  }
  public async handleDynamoDbUpdate(
    update: DynamoDbEntityUpdate,
    dbClients: DbClients
  ) {
    updateLogMetadata({ entityId: update.entityId })
    if (update.type === 'TRANSACTION' && this.transactionHandler) {
      await this.transactionHandler(
        update.tenantId,
        update.OldImage as TransactionWithRulesResult,
        update.NewImage as TransactionWithRulesResult,
        dbClients
      )
    } else if (
      update.type === 'TRANSACTION_EVENT' &&
      this.transactionEventHandler
    ) {
      await this.transactionEventHandler(
        update.tenantId,
        update.OldImage as TransactionEvent,
        update.NewImage as TransactionEvent,
        dbClients
      )
    } else if (update.type === 'USER' && this.userHandler) {
      await this.userHandler(
        update.tenantId,
        update.OldImage as User,
        update.NewImage as User,
        dbClients
      )
    } else if (
      (update.type === 'CONSUMER_USER_EVENT' ||
        update.type === 'BUSINESS_USER_EVENT') &&
      this.userEventHandler
    ) {
      await this.userEventHandler(
        update.tenantId,
        update.OldImage as ConsumerUserEvent | BusinessUserEvent,
        update.NewImage as ConsumerUserEvent | BusinessUserEvent,
        dbClients
      )
    } else if (update.type === 'ARS_VALUE' && this.arsScoreEventHandler) {
      await this.arsScoreEventHandler(
        update.tenantId,
        update.OldImage as ArsScore,
        update.NewImage as ArsScore,
        dbClients
      )
    } else if (update.type === 'DRS_VALUE' && this.drsScoreEventHandler) {
      await this.drsScoreEventHandler(
        update.tenantId,
        update.OldImage as DrsScore,
        update.NewImage as DrsScore,
        dbClients
      )
    } else if (update.type === 'KRS_VALUE' && this.krsScoreEventHandler) {
      await this.krsScoreEventHandler(
        update.tenantId,
        update.OldImage as KrsScore,
        update.NewImage as KrsScore,
        dbClients
      )
    } else if (update.type === 'RULE_INSTANCE' && this.ruleInstanceHandler) {
      await this.ruleInstanceHandler(
        update.tenantId,
        update.OldImage as RuleInstance,
        update.NewImage as RuleInstance,
        dbClients
      )
    }
  }

  public buildSqsFanOutHandler() {
    return async (event: SQSEvent) => {
      const updates = event.Records.map(
        (record) => JSON.parse(record.body) as DynamoDbEntityUpdate
      )
      const groups = groupBy(updates, (update) => update.tenantId)
      await Promise.all(
        Object.entries(groups).map(async (entry) => {
          const tenantId = entry[0]
          const tenantUpdates = entry[1]
          await this.handleSqsDynamoUpdates(tenantId, tenantUpdates)
        })
      )
    }
  }

  public buildKinesisStreamHandler() {
    return async (event: KinesisStreamEvent) => {
      const updates = getDynamoDbUpdates(event)
      const groups = groupBy(updates, (update) => update.tenantId)
      await Promise.all(
        Object.entries(groups).map(async (entry) => {
          const tenantId = entry[0]
          const tenantUpdates = entry[1]
          await this.handleKinesisDynamoUpdates(tenantId, tenantUpdates)
        })
      )
    }
  }

  private async handleSqsDynamoUpdates(
    tenantId: string,
    updates: DynamoDbEntityUpdate[]
  ) {
    await withContext(async () => {
      const dbClients: DbClients = {
        dynamoDb: getDynamoDbClient(),
        mongoDb: await getMongoDbClient(),
      }
      await initializeTenantContext(tenantId)
      for (const update of updates) {
        await this.handleDynamoDbUpdate(update, dbClients)
      }
    })
  }

  private async handleKinesisDynamoUpdates(
    tenantId: string,
    updates: DynamoDbEntityUpdate[]
  ) {
    await withContext(async () => {
      const dbClients: DbClients = {
        dynamoDb: getDynamoDbClient(),
        mongoDb: await getMongoDbClient(),
      }
      await initializeTenantContext(tenantId)
      const tenantHasFeatureKinesisAsync = await tenantHasFeature(
        tenantId,
        'KINESIS_ASYNC'
      )

      const filteredUpdates = updates.filter(Boolean)
      await Promise.all(
        filteredUpdates.map(async (update) => {
          /**   Store DynamoDB Keys in MongoDB * */
          if (update.NewImage && !update.NewImage.ttl) {
            await savePartitionKey(
              update.tenantId,
              update.partitionKeyId,
              this.tableName
            )
          }
        })
      )

      if (envIs('local', 'test') || !tenantHasFeatureKinesisAsync) {
        for (const update of filteredUpdates) {
          await this.handleDynamoDbUpdate(update, dbClients)
        }
        return
      }

      function chunkArray<T>(
        array: Array<T>,
        chunkSize: number
      ): Array<Array<T>> {
        const chunks: Array<Array<T>> = []
        for (let i = 0; i < array.length; i += chunkSize) {
          chunks.push(array.slice(i, i + chunkSize))
        }
        return chunks
      }

      const entries = filteredUpdates.map(
        (update, i): SendMessageBatchRequestEntry => {
          const messageGroupId = update.tenantId
          const messageDeduplicationId = `${update.entityId}-${update.sequenceNumber}`

          const payload = JSON.stringify(update)
          const byteLength = Buffer.byteLength(payload, 'utf8')
          if (byteLength > 262144) {
            logger.error(`Payload size exceeds size limit: ${payload}`)
          }

          return {
            Id: `${i}`,
            MessageBody: payload,
            MessageGroupId: messageGroupId,
            MessageDeduplicationId: messageDeduplicationId,
          }
        }
      )

      const chunkedEntries = chunkArray(entries, 10)

      for (const chunk of chunkedEntries) {
        await sqsClient.send(
          new SendMessageBatchCommand({
            Entries: chunk,
            QueueUrl: this.fanOutSqsQueue,
          })
        )
      }
    })
  }
}
