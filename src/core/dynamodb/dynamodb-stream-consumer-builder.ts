import { KinesisStreamEvent } from 'aws-lambda'
import { getDynamoDbUpdates } from './dynamodb-stream-utils'
import { TransactionWithRulesResult } from '@/@types/openapi-public/TransactionWithRulesResult'
import { User } from '@/@types/openapi-public/User'
import { TransactionEvent } from '@/@types/openapi-public/TransactionEvent'
import { ConsumerUserEvent } from '@/@types/openapi-public/ConsumerUserEvent'

type TransactionHandler = (
  tenantId: string,
  oldTransaction: TransactionWithRulesResult,
  newTransaction: TransactionWithRulesResult
) => Promise<void>
type TransactionEventHandler = (
  tenantId: string,
  oldTransactionEvent: TransactionEvent,
  newTransactionEvent: TransactionEvent
) => Promise<void>
type UserHanlder = (
  tenantId: string,
  oldUser: User,
  newUser: User
) => Promise<void>
type ConsumerUserEventHandler = (
  tenantId: string,
  oldUserEvent: ConsumerUserEvent,
  newUserEvent: ConsumerUserEvent
) => Promise<void>

export class TarponStreamConsumerBuilder {
  transactionHandler?: TransactionHandler
  transactionEventHandler?: TransactionEventHandler
  userHandler?: UserHanlder
  consumerUserEventHandler?: ConsumerUserEventHandler

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
  public setConsumerUserEventHandler(
    userEventHandler: ConsumerUserEventHandler
  ): TarponStreamConsumerBuilder {
    this.consumerUserEventHandler = userEventHandler
    return this
  }

  public build() {
    return async (event: KinesisStreamEvent) => {
      for (const update of getDynamoDbUpdates(event)) {
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
          update.type === 'CONSUMER_USER_EVENT' &&
          this.consumerUserEventHandler
        ) {
          await this.consumerUserEventHandler(
            update.tenantId,
            update.OldImage as ConsumerUserEvent,
            update.NewImage as ConsumerUserEvent
          )
        }
      }
    }
  }
}
