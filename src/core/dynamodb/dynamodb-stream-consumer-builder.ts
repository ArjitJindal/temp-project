import { KinesisStreamEvent } from 'aws-lambda'
import { KinesisClient, PutRecordCommand } from '@aws-sdk/client-kinesis'
import { TransientRepository } from '../repositories/transient-repository'
import { logger } from '../logger'
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

const kinesisClient = new KinesisClient({})

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

export class TarponStreamConsumerBuilder {
  retryStreamName: string
  transientRepository: TransientRepository
  transactionHandler?: TransactionHandler
  transactionEventHandler?: TransactionEventHandler
  userHandler?: UserHanlder
  userEventHandler?: UserEventHandler

  constructor(retryStreamName: string) {
    this.retryStreamName = retryStreamName
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

  private async handleDynamoDbUpdate(update: DynamoDbEntityUpdate) {
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

  private async shouldSendToRetryStream(
    update: DynamoDbEntityUpdate
  ): Promise<boolean> {
    return this.transientRepository.hasPrimaryKeyId(
      this.getRetryItemKey(update)
    )
  }

  private async sendToRetryStream(update: DynamoDbEntityUpdate) {
    const response = await kinesisClient.send(
      new PutRecordCommand({
        StreamName: this.retryStreamName,
        PartitionKey: 'default',
        Data: Buffer.from(update.rawRecord?.kinesis.data as string, 'base64'),
      })
    )
    const partitionKeyId = this.getRetryItemKey(update)
    await this.transientRepository.addKey(
      partitionKeyId,
      response.SequenceNumber as string
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

  private isFromRetryStream(event: KinesisStreamEvent) {
    return event.Records[0]?.eventSourceARN?.includes(this.retryStreamName)
  }

  private getRetryItemKey(update: DynamoDbEntityUpdate): string {
    return `${this.retryStreamName}#${update.entityId}`
  }

  public build() {
    return async (event: KinesisStreamEvent) => {
      if (!this.retryStreamName) {
        if (process.env.ENV !== 'local') {
          throw new Error(`Retry stream is not set!`)
        }
        this.retryStreamName = 'localRetrStream'
      }

      const isFromRetryStream = this.isFromRetryStream(event)

      if (isFromRetryStream) {
        for (const update of getDynamoDbUpdates(event)) {
          if (await this.shouldRun(update)) {
            try {
              await this.handleDynamoDbUpdate(update)
              await this.handleUpdateSuccess(update)
              logger.info('Retry SUCCESS', {
                tenantId: update.tenantId,
                entityId: update.entityId,
                sequenceNumber: update.sequenceNumber,
              })
            } catch (e) {
              logger.error((e as Error).message, {
                tenantId: update.tenantId,
                entityId: update.entityId,
                sequenceNumber: update.sequenceNumber,
              })
              throw e
            }
          }
        }
      } else {
        for (const update of getDynamoDbUpdates(event)) {
          if (await this.shouldSendToRetryStream(update)) {
            await this.sendToRetryStream(update)
            logger.warn(
              `There're other events for the entity currently being retried. Sent to retry stream.`,
              {
                tenantId: update.tenantId,
                entityId: update.entityId,
              }
            )
          } else {
            try {
              await this.handleDynamoDbUpdate(update)
            } catch (e) {
              await this.sendToRetryStream(update)
              logger.error(e)
              logger.warn(`Failed to process. Sent to retry stream`, {
                tenantId: update.tenantId,
                entityId: update.entityId,
              })
            }
          }
        }
      }
    }
  }
}
