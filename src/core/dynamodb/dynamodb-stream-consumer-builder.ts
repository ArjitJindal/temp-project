import { KinesisStreamEvent, KinesisStreamRecord, SQSEvent } from 'aws-lambda'
import { SendMessageCommand, SQSClient } from '@aws-sdk/client-sqs'
import { TransientRepository } from '../repositories/transient-repository'
import { logger } from '../logger'
import {
  getContext,
  getContextStorage,
  updateLogMetadata,
} from '../utils/context'
import {
  DynamoDbEntityUpdate,
  getDynamoDbUpdates,
} from './dynamodb-stream-utils'
import { TransactionWithRulesResult } from '@/@types/openapi-public/TransactionWithRulesResult'
import { User } from '@/@types/openapi-public/User'
import { TransactionEvent } from '@/@types/openapi-public/TransactionEvent'
import { ConsumerUserEvent } from '@/@types/openapi-public/ConsumerUserEvent'
import { BusinessUserEvent } from '@/@types/openapi-public/BusinessUserEvent'
import { getDynamoDbClient } from '@/utils/dynamodb'

const sqsClient = new SQSClient({})

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
type UserHanlder = (
  tenantId: string,
  oldUser: User | undefined,
  newUser: User | undefined
) => Promise<void>
type UserEventHandler = (
  tenantId: string,
  oldUserEvent: ConsumerUserEvent | undefined,
  newUserEvent: ConsumerUserEvent | undefined
) => Promise<void>

// TODO (FDT-45408): Refactor TarponStreamConsumerBuilder to support any DynamoDB table

export class TarponStreamConsumerBuilder {
  name: string
  retrySqsQueue: string
  transientRepository: TransientRepository
  transactionHandler?: TransactionHandler
  transactionEventHandler?: TransactionEventHandler
  userHandler?: UserHanlder
  userEventHandler?: UserEventHandler

  constructor(name: string, retrySqsQueue: string) {
    this.name = name
    this.retrySqsQueue = retrySqsQueue
    this.transientRepository = new TransientRepository(getDynamoDbClient())
  }

  public setTransactionHandler(
    transactionHandler: TransactionHandler
  ): TarponStreamConsumerBuilder {
    this.transactionHandler = transactionHandler
    return this
  }
  public setTransactionEventHandler(
    transactionEventHandler: TransactionEventHandler
  ): TarponStreamConsumerBuilder {
    this.transactionEventHandler = transactionEventHandler
    return this
  }
  public setUserHandler(userHandler: UserHanlder): TarponStreamConsumerBuilder {
    this.userHandler = userHandler
    return this
  }
  public setUserEventHandler(
    userEventHandler: UserEventHandler
  ): TarponStreamConsumerBuilder {
    this.userEventHandler = userEventHandler
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
    await sqsClient.send(
      new SendMessageCommand({
        MessageBody: JSON.stringify(update.rawRecord!),
        QueueUrl: this.retrySqsQueue,
        MessageGroupId: update.entityId,
        MessageDeduplicationId: `${update.entityId}-${update.sequenceNumber}`,
      })
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
    return `${this.name}#${update.entityId}`
  }

  public buildSqsRetryHandler() {
    return async (event: SQSEvent) => {
      for (const record of event.Records) {
        const kinesisStreamRecord = JSON.parse(
          record.body
        ) as KinesisStreamRecord

        for (const update of getDynamoDbUpdates({
          Records: [kinesisStreamRecord],
        })) {
          await getContextStorage().run(getContext() || {}, async () => {
            if (await this.shouldRun(update)) {
              updateLogMetadata({
                tenantId: update.tenantId,
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
        }
      }
    }
  }

  public buildKinesisStreamHandler() {
    return async (event: KinesisStreamEvent) => {
      for (const update of getDynamoDbUpdates(event)) {
        await getContextStorage().run(getContext() || {}, async () => {
          updateLogMetadata({
            tenantId: update.tenantId,
            entityId: update.entityId,
          })
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
              logger.warn(`Failed to process. Sent to retry queue`)
            }
          }
        })
      }
    }
  }
}
