import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb'
import { compact, uniqBy } from 'lodash'
import { UserRepository } from '../users/repositories/user-repository'
import { UserEventRepository } from '../rules-engine/repositories/user-event-repository'
import { TransactionEventRepository } from '../rules-engine/repositories/transaction-event-repository'
import { DynamoDbTransactionRepository } from '../rules-engine/repositories/dynamodb-transaction-repository'
import { TransactionEvent } from '@/@types/openapi-internal/TransactionEvent'
import { BatchResponse } from '@/@types/openapi-public/BatchResponse'
import { Business } from '@/@types/openapi-public/Business'
import { BusinessUserEvent } from '@/@types/openapi-public/BusinessUserEvent'
import { ConsumerUserEvent } from '@/@types/openapi-public/ConsumerUserEvent'
import { Transaction } from '@/@types/openapi-public/Transaction'
import { User } from '@/@types/openapi-public/User'
import { BatchResponseFailedRecord } from '@/@types/openapi-public/BatchResponseFailedRecord'
import { BatchResponseStatus } from '@/@types/openapi-public/BatchResponseStatus'
import { UserWithRulesResult } from '@/@types/openapi-public/UserWithRulesResult'
import { BusinessWithRulesResult } from '@/@types/openapi-public/BusinessWithRulesResult'
import { TransactionWithRulesResult } from '@/@types/openapi-public/TransactionWithRulesResult'

const ID_ALREADY_EXISTS = 'ID_ALREADY_EXISTS'
const ID_NOT_FOUND = 'ID_NOT_FOUND'
const RELATED_ID_NOT_FOUND = 'RELATED_ID_NOT_FOUND'
const ORIGIN_USER_ID_NOT_FOUND = 'ORIGIN_USER_ID_NOT_FOUND'
const DESTINATION_USER_ID_NOT_FOUND = 'DESTINATION_USER_ID_NOT_FOUND'
const DUPLICATE_ID_IN_BATCH = 'DUPLICATE_ID_IN_BATCH'

type BatchImportErrorReason =
  | typeof ID_ALREADY_EXISTS
  | typeof DUPLICATE_ID_IN_BATCH
  | typeof RELATED_ID_NOT_FOUND
  | typeof ID_NOT_FOUND
  | typeof ORIGIN_USER_ID_NOT_FOUND
  | typeof DESTINATION_USER_ID_NOT_FOUND

type TransactionValidationOptions = {
  validateOriginUserId?: boolean
  validateDestinationUserId?: boolean
}

export class BatchImportService {
  private readonly transactionRepository: DynamoDbTransactionRepository
  private readonly userRepository: UserRepository
  private readonly userEventRepository: UserEventRepository
  private readonly transactionEventRepository: TransactionEventRepository

  constructor(
    private readonly tenantId: string,
    readonly connections: {
      dynamoDb: DynamoDBDocumentClient
    }
  ) {
    this.transactionRepository = new DynamoDbTransactionRepository(
      this.tenantId,
      connections.dynamoDb
    )
    this.userRepository = new UserRepository(this.tenantId, {
      dynamoDb: connections.dynamoDb,
    })
    this.userEventRepository = new UserEventRepository(this.tenantId, {
      dynamoDb: connections.dynamoDb,
    })
    this.transactionEventRepository = new TransactionEventRepository(
      this.tenantId,
      {
        dynamoDb: connections.dynamoDb,
      }
    )
  }

  public async importTransactions(
    batchId: string,
    transactions: Transaction[],
    validationOptions?: TransactionValidationOptions
  ): Promise<{
    response: BatchResponse
    validatedTransactions: Transaction[]
  }> {
    const existingTransactions =
      await this.transactionRepository.getTransactionsByIds(
        transactions.map((transaction) => transaction.transactionId)
      )
    const relatedTransactionIds = compact(
      transactions.flatMap((transaction) => transaction.relatedTransactionIds)
    )
    const existingRelatedTransactions =
      await this.transactionRepository.getTransactionsByIds(
        relatedTransactionIds
      )
    const allUserIds = compact(
      transactions.flatMap((transaction) => [
        transaction.originUserId,
        transaction.destinationUserId,
      ])
    )
    const existingUsers = await this.userRepository.getUsersByIds(allUserIds)
    const failedRecords: BatchResponseFailedRecord[] = []
    const idsCountMap = new Map<string, number>()
    for (const transaction of transactions) {
      idsCountMap.set(
        transaction.transactionId,
        (idsCountMap.get(transaction.transactionId) ?? 0) + 1
      )
    }
    const validatedTransactions: Transaction[] = []
    for (const transaction of transactions) {
      const validationError = this.validateTransaction(
        transaction,
        {
          existingTransactions,
          existingRelatedTransactions,
          existingUsers,
          idsCountMap,
        },
        validationOptions
      )
      if (validationError) {
        failedRecords.push({
          id: transaction.transactionId,
          reasonCode: validationError,
        })
      } else {
        validatedTransactions.push(transaction)
      }
    }
    return {
      response: {
        status: this.getBatchResponseStatus(
          transactions.length,
          failedRecords.length
        ),
        batchId,
        successful: transactions.length - failedRecords.length,
        failed: failedRecords.length,
        failedRecords:
          failedRecords.length > 0 ? uniqBy(failedRecords, 'id') : undefined,
        message: this.getBatchResponseMessage(
          transactions.length,
          failedRecords.length
        ),
      },
      validatedTransactions,
    }
  }

  private validateTransaction(
    transaction: Transaction,
    data: {
      existingTransactions: TransactionWithRulesResult[]
      existingRelatedTransactions: TransactionWithRulesResult[]
      existingUsers: (UserWithRulesResult | BusinessWithRulesResult)[]
      idsCountMap: Map<string, number>
    },
    validationOptions?: TransactionValidationOptions
  ): BatchImportErrorReason | null {
    if ((data.idsCountMap.get(transaction.transactionId) ?? 0) > 1) {
      return DUPLICATE_ID_IN_BATCH
    }
    if (
      data.existingTransactions.find(
        (t) => t.transactionId === transaction.transactionId
      )
    ) {
      return ID_ALREADY_EXISTS
    }
    if (
      transaction.relatedTransactionIds?.some(
        (id) =>
          !data.existingRelatedTransactions.find((t) => t.transactionId === id)
      )
    ) {
      return RELATED_ID_NOT_FOUND
    }
    if (
      validationOptions?.validateOriginUserId &&
      transaction.originUserId &&
      !data.existingUsers.find((u) => u.userId === transaction.originUserId)
    ) {
      return ORIGIN_USER_ID_NOT_FOUND
    }
    if (
      validationOptions?.validateDestinationUserId &&
      transaction.destinationUserId &&
      !data.existingUsers.find(
        (u) => u.userId === transaction.destinationUserId
      )
    ) {
      return DESTINATION_USER_ID_NOT_FOUND
    }
    return null
  }

  public async importTransactionEvents(
    batchId: string,
    transactionEvents: TransactionEvent[]
  ): Promise<{
    response: BatchResponse
    validatedTransactionEvents: TransactionEvent[]
  }> {
    const relatedTransactionIds = compact(
      transactionEvents.flatMap(
        (t) => t.updatedTransactionAttributes?.relatedTransactionIds
      )
    )

    const [existingTransactions, existingRelatedTransactions] =
      await Promise.all([
        this.transactionRepository.getTransactionsByIds(
          transactionEvents.map((event) => event.transactionId)
        ),
        this.transactionRepository.getTransactionsByIds(relatedTransactionIds),
      ])

    const validatedTransactionEvents: TransactionEvent[] = []
    const failedRecords: BatchResponseFailedRecord[] = []
    for (const transactionEvent of transactionEvents) {
      const validationError = this.validateTransactionEvent(transactionEvent, {
        existingTransactions,
        existingRelatedTransactions,
      })
      if (validationError) {
        failedRecords.push({
          id:
            validationError === ID_NOT_FOUND
              ? transactionEvent.transactionId
              : transactionEvent.eventId,
          reasonCode: validationError,
        })
      } else {
        validatedTransactionEvents.push(transactionEvent)
      }
    }
    return {
      response: {
        status: this.getBatchResponseStatus(
          transactionEvents.length,
          failedRecords.length
        ),
        batchId,
        successful: transactionEvents.length - failedRecords.length,
        failed: failedRecords.length,
        failedRecords: failedRecords.length > 0 ? failedRecords : undefined,
        message: this.getBatchResponseMessage(
          transactionEvents.length,
          failedRecords.length
        ),
      },
      validatedTransactionEvents,
    }
  }
  private validateTransactionEvent(
    transactionEvent: TransactionEvent,
    data: {
      existingTransactions: TransactionWithRulesResult[]
      existingRelatedTransactions: TransactionWithRulesResult[]
    }
  ): BatchImportErrorReason | null {
    if (
      !data.existingTransactions.find(
        (t) => t.transactionId === transactionEvent.transactionId
      )
    ) {
      return ID_NOT_FOUND
    }
    if (
      transactionEvent.updatedTransactionAttributes?.relatedTransactionIds?.some(
        (id) =>
          !data.existingRelatedTransactions.find((t) => t.transactionId === id)
      )
    ) {
      return RELATED_ID_NOT_FOUND
    }
    return null
  }

  public async importConsumerUsers(
    batchId: string,
    users: User[]
  ): Promise<{ response: BatchResponse; validatedUsers: User[] }> {
    return this.importUsers<User>(batchId, users)
  }

  public async importBusinessUsers(
    batchId: string,
    users: Business[]
  ): Promise<{ response: BatchResponse; validatedUsers: Business[] }> {
    return this.importUsers<Business>(batchId, users)
  }

  private async importUsers<T extends User | Business>(
    batchId: string,
    users: Array<T>
  ): Promise<{
    response: BatchResponse
    validatedUsers: Array<T>
  }> {
    const existingUsers = await this.userRepository.getUsersByIds(
      users.map((user) => user.userId)
    )
    const idsCountMap = new Map<string, number>()
    for (const user of users) {
      idsCountMap.set(user.userId, (idsCountMap.get(user.userId) ?? 0) + 1)
    }
    const parentUserIds = compact(
      users.map((user) => user.linkedEntities?.parentUserId)
    )
    const existingParentUsers = await this.userRepository.getUsersByIds(
      parentUserIds
    )
    const failedRecords: BatchResponseFailedRecord[] = []
    const validatedUsers: T[] = []
    for (const user of users) {
      const validationError = this.validateUser(user, {
        existingUsers,
        existingParentUsers,
        idsCountMap,
      })
      if (validationError) {
        failedRecords.push({
          id: user.userId,
          reasonCode: validationError,
        })
      } else {
        validatedUsers.push(user)
      }
    }
    return {
      response: {
        status: this.getBatchResponseStatus(users.length, failedRecords.length),
        batchId,
        successful: users.length - failedRecords.length,
        failed: failedRecords.length,
        failedRecords:
          failedRecords.length > 0 ? uniqBy(failedRecords, 'id') : undefined,
        message: this.getBatchResponseMessage(
          users.length,
          failedRecords.length
        ),
      },
      validatedUsers,
    }
  }

  private validateUser(
    user: User | Business,
    data: {
      existingUsers: (UserWithRulesResult | BusinessWithRulesResult)[]
      existingParentUsers: (UserWithRulesResult | BusinessWithRulesResult)[]
      idsCountMap: Map<string, number>
    }
  ): BatchImportErrorReason | null {
    if ((data.idsCountMap.get(user.userId) ?? 0) > 1) {
      return DUPLICATE_ID_IN_BATCH
    }
    if (data.existingUsers.find((u) => u.userId === user.userId)) {
      return ID_ALREADY_EXISTS
    }
    if (
      user.linkedEntities?.parentUserId &&
      !data.existingParentUsers.find(
        (u) => u.userId === user.linkedEntities?.parentUserId
      )
    ) {
      return RELATED_ID_NOT_FOUND
    }
    return null
  }

  public async importConsumerUserEvents(
    batchId: string,
    userEvents: ConsumerUserEvent[]
  ): Promise<{
    response: BatchResponse
    validatedUserEvents: ConsumerUserEvent[]
  }> {
    return this.importUserEvents(batchId, userEvents)
  }

  public async importBusinessUserEvents(
    batchId: string,
    userEvents: BusinessUserEvent[]
  ): Promise<{
    response: BatchResponse
    validatedUserEvents: BusinessUserEvent[]
  }> {
    return this.importUserEvents(batchId, userEvents)
  }

  private async importUserEvents(
    batchId: string,
    userEvents: Array<ConsumerUserEvent | BusinessUserEvent>
  ): Promise<{
    response: BatchResponse
    validatedUserEvents: Array<ConsumerUserEvent | BusinessUserEvent>
  }> {
    const parentUserIds = compact(
      userEvents.map(
        (event) =>
          (event as BusinessUserEvent).updatedBusinessUserAttributes
            ?.linkedEntities?.parentUserId ??
          (event as ConsumerUserEvent).updatedConsumerUserAttributes
            ?.linkedEntities?.parentUserId
      )
    )
    const [existingUsers, existingParentUsers] = await Promise.all([
      this.userRepository.getUsersByIds(
        userEvents.map((event) => event.userId)
      ),
      this.userRepository.getUsersByIds(parentUserIds),
    ])

    const failedRecords: BatchResponseFailedRecord[] = []
    const validatedUserEvents: Array<ConsumerUserEvent | BusinessUserEvent> = []
    for (const userEvent of userEvents) {
      const validationError = this.validateUserEvent(userEvent, {
        existingUsers,
        existingParentUsers,
      })
      if (validationError) {
        failedRecords.push({
          id:
            validationError === ID_NOT_FOUND
              ? userEvent.userId
              : userEvent.eventId,
          reasonCode: validationError,
        })
      } else {
        validatedUserEvents.push(userEvent)
      }
    }
    return {
      response: {
        status: this.getBatchResponseStatus(
          userEvents.length,
          failedRecords.length
        ),
        batchId,
        successful: userEvents.length - failedRecords.length,
        failed: failedRecords.length,
        failedRecords: failedRecords.length > 0 ? failedRecords : undefined,
        message: this.getBatchResponseMessage(
          userEvents.length,
          failedRecords.length
        ),
      },
      validatedUserEvents,
    }
  }
  private validateUserEvent(
    userEvent: ConsumerUserEvent | BusinessUserEvent,
    data: {
      existingUsers: (UserWithRulesResult | BusinessWithRulesResult)[]
      existingParentUsers: (UserWithRulesResult | BusinessWithRulesResult)[]
    }
  ): BatchImportErrorReason | null {
    if (!data.existingUsers.find((u) => u.userId === userEvent.userId)) {
      return ID_NOT_FOUND
    }
    const parentId =
      (userEvent as ConsumerUserEvent).updatedConsumerUserAttributes
        ?.linkedEntities?.parentUserId ??
      (userEvent as BusinessUserEvent).updatedBusinessUserAttributes
        ?.linkedEntities?.parentUserId
    if (
      parentId &&
      !data.existingParentUsers.find((u) => u.userId === parentId)
    ) {
      return RELATED_ID_NOT_FOUND
    }
    return null
  }

  private getBatchResponseStatus(
    totalRecordsCount: number,
    failedRecordsCount: number
  ): BatchResponseStatus {
    if (failedRecordsCount === 0) {
      return 'SUCCESS'
    }
    if (failedRecordsCount === totalRecordsCount) {
      return 'FAILURE'
    }
    return 'PARTIAL_FAILURE'
  }
  private getBatchResponseMessage(
    totalRecordsCount: number,
    failedRecordsCount: number
  ): string | undefined {
    if (failedRecordsCount === 0) {
      return
    }
    return `${failedRecordsCount} of ${totalRecordsCount} records failed validation`
  }
}
