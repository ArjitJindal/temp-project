import { SQSEvent } from 'aws-lambda'
import { SendMessageBatchCommand } from '@aws-sdk/client-sqs'
import { SendMessageBatchRequestEntry } from '@aws-sdk/client-sqs/dist-types/models/models_0'
import { TransientRepository } from '../repositories/transient-repository'
import { logger } from '../logger'
import {
  initializeTenantContext,
  tenantHasFeature,
  updateLogMetadata,
  withContext,
} from '../utils/context'
import { DynamoDbEntityUpdate, savePartitionKey } from './dynamodb-stream-utils'
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

type TransactionHandler = (
  tenantId: string,
  oldTransaction: TransactionWithRulesResult | undefined,
  newTransaction: TransactionWithRulesResult | undefined
) => Promise<void>
type TransactionEventHandler = (
  tenantId: string,
  oldTransactionEvent: TransactionEvent | undefined,
  newTransactionEvent: TransactionEvent | undefined
) => Promise<void>
type UserHandler = (
  tenantId: string,
  oldUser: User | undefined,
  newUser: User | undefined
) => Promise<void>
type UserEventHandler = (
  tenantId: string,
  oldUserEvent: ConsumerUserEvent | undefined,
  newUserEvent: ConsumerUserEvent | undefined
) => Promise<void>
type ArsScoreEventHandler = (
  tenantId: string,
  oldArsValue: ArsScore | undefined,
  newArsValue: ArsScore | undefined
) => Promise<void>
type DrsScoreEventHandler = (
  tenantId: string,
  oldDrsValue: DrsScore | undefined,
  newDrsValue: DrsScore | undefined
) => Promise<void>
type KrsScoreEventHandler = (
  tenantId: string,
  oldKrsValue: KrsScore | undefined,
  newKrsValue: KrsScore | undefined
) => Promise<void>
type RuleInstanceHandler = (
  tenantId: string,
  oldRuleInstance: RuleInstance | undefined,
  newRuleInstance: RuleInstance | undefined
) => Promise<void>

const sqsClient = getSQSClient()

export class StreamConsumerBuilder {
  name: string
  retrySqsQueue: string
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

  constructor(name: string, retrySqsQueue: string, tableName: string) {
    this.name = name
    this.retrySqsQueue = retrySqsQueue
    this.transientRepository = new TransientRepository(getDynamoDbClient())
    this.tableName = tableName
    this.processDynamoDbUpdate = this.processDynamoDbUpdate.bind(this)
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
  public async handleDynamoDbUpdate(update: DynamoDbEntityUpdate) {
    if (update.type === 'TRANSACTION' && this.transactionHandler) {
      await this.transactionHandler(
        update.tenantId,
        update.OldImage as TransactionWithRulesResult,
        update.NewImage as TransactionWithRulesResult
      )
    } else if (
      update.type === 'TRANSACTION_EVENT' &&
      this.transactionEventHandler
    ) {
      await this.transactionEventHandler(
        update.tenantId,
        update.OldImage as TransactionEvent,
        update.NewImage as TransactionEvent
      )
    } else if (update.type === 'USER' && this.userHandler) {
      await this.userHandler(
        update.tenantId,
        update.OldImage as User,
        update.NewImage as User
      )
    } else if (
      (update.type === 'CONSUMER_USER_EVENT' ||
        update.type === 'BUSINESS_USER_EVENT') &&
      this.userEventHandler
    ) {
      await this.userEventHandler(
        update.tenantId,
        update.OldImage as ConsumerUserEvent | BusinessUserEvent,
        update.NewImage as ConsumerUserEvent | BusinessUserEvent
      )
    } else if (update.type === 'ARS_VALUE' && this.arsScoreEventHandler) {
      await this.arsScoreEventHandler(
        update.tenantId,
        update.OldImage as ArsScore,
        update.NewImage as ArsScore
      )
    } else if (update.type === 'DRS_VALUE' && this.drsScoreEventHandler) {
      await this.drsScoreEventHandler(
        update.tenantId,
        update.OldImage as DrsScore,
        update.NewImage as DrsScore
      )
    } else if (update.type === 'KRS_VALUE' && this.krsScoreEventHandler) {
      await this.krsScoreEventHandler(
        update.tenantId,
        update.OldImage as KrsScore,
        update.NewImage as KrsScore
      )
    } else if (update.type === 'RULE_INSTANCE' && this.ruleInstanceHandler) {
      await this.ruleInstanceHandler(
        update.tenantId,
        update.OldImage as RuleInstance,
        update.NewImage as RuleInstance
      )
    }
  }

  private async shouldSendToRetryQueue(
    update: DynamoDbEntityUpdate
  ): Promise<boolean> {
    return this.transientRepository.hasPrimaryKeyId(
      this.getRetryItemKey(update)
    )
  }

  private async sendToRetryQueue(update: DynamoDbEntityUpdate) {
    if (!update.NewImage) {
      return
    }
    await this.sendDynamoUpdate(
      update.tenantId,
      [update],
      this.retrySqsQueue,
      true
    )
    const partitionKeyId = this.getRetryItemKey(update)
    await this.transientRepository.addKey(
      partitionKeyId,
      update.sequenceNumber as string
    )
  }

  private async handleUpdateSuccess(update: DynamoDbEntityUpdate) {
    const partitionKeyId = this.getRetryItemKey(update)
    await this.transientRepository.deleteKey(
      partitionKeyId,
      update.sequenceNumber as string
    )
  }

  private async shouldRun(update: DynamoDbEntityUpdate) {
    const partitionKeyId = this.getRetryItemKey(update)
    return await this.transientRepository.hasKey(
      partitionKeyId,
      update.sequenceNumber as string
    )
  }

  private getRetryItemKey(update: DynamoDbEntityUpdate): string {
    return `${this.name}#${update.tenantId}#${update.entityId}`
  }

  public buildHandler(handle: (update: DynamoDbEntityUpdate) => Promise<void>) {
    return async (event: SQSEvent) => {
      for (const sqsRecord of event.Records) {
        const record: DynamoDbEntityUpdate = JSON.parse(sqsRecord.body)
        await handle(record)
      }
    }
  }

  public buildSqsRetryHandler() {
    return this.buildHandler(async (update) => {
      if (!update.type) {
        return
      }
      await withContext(async () => {
        await initializeTenantContext(update.tenantId)
        if (await this.shouldRun(update)) {
          updateLogMetadata({
            entityId: update.entityId,
            sequenceNumber: update.sequenceNumber,
          })
          try {
            await this.handleDynamoDbUpdate(update)
            await this.handleUpdateSuccess(update)
            logger.info('Retry SUCCESS')
          } catch (e) {
            logger.error((e as Error).message)
            throw e
          }
        }
      })
    })
  }

  public async processDynamoDbUpdate(update: DynamoDbEntityUpdate) {
    if (!update.type) {
      return
    }
    updateLogMetadata({ entityId: update.entityId })
    if (await this.shouldSendToRetryQueue(update)) {
      await this.sendToRetryQueue(update)
      logger.warn(
        `There're other events for the entity currently being retried. Sent to retry queue.`
      )
    } else {
      try {
        await this.handleDynamoDbUpdate(update)
      } catch (e) {
        await this.sendToRetryQueue(update)
        logger.error(e)
        if (e instanceof Error) {
          logger.error(e.stack)
        }
        logger.warn(`Failed to process. Sent to retry queue`)
      }
    }
  }

  public async sendDynamoUpdate(
    tenantId: string,
    updates: DynamoDbEntityUpdate[],
    queueUrl: string,
    retry = false
  ) {
    await withContext(async () => {
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

      if ((envIs('local', 'test') || !tenantHasFeatureKinesisAsync) && !retry) {
        for (const update of filteredUpdates) {
          await this.processDynamoDbUpdate(update)
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
            QueueUrl: queueUrl,
          })
        )
      }
    })
  }
}
