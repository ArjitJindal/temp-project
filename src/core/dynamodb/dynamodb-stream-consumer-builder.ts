import { KinesisStreamEvent } from 'aws-lambda'
import { getDynamoDbUpdates } from './dynamodb-stream-utils'
import { TransactionWithRulesResult } from '@/@types/openapi-public/TransactionWithRulesResult'
import { User } from '@/@types/openapi-public/User'
import { TransactionEvent } from '@/@types/openapi-public/TransactionEvent'
import { ConsumerUserEvent } from '@/@types/openapi-public/ConsumerUserEvent'
import { BusinessUserEvent } from '@/@types/openapi-public/BusinessUserEvent'

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
  transactionHandler?: TransactionHandler
  transactionEventHandler?: TransactionEventHandler
  userHandler?: UserHanlder
  userEventHandler?: UserEventHandler

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
    }
  }
}
