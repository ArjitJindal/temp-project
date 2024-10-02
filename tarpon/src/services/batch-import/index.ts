import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb'
import { MongoClient } from 'mongodb'
import { compact, uniqBy } from 'lodash'
import { MongoDbTransactionRepository } from '../rules-engine/repositories/mongodb-transaction-repository'
import { UserRepository } from '../users/repositories/user-repository'
import { UserEventRepository } from '../rules-engine/repositories/user-event-repository'
import { TransactionEventRepository } from '../rules-engine/repositories/transaction-event-repository'
import { TransactionEvent } from '@/@types/openapi-internal/TransactionEvent'
import { BatchResponse } from '@/@types/openapi-public/BatchResponse'
import { Business } from '@/@types/openapi-public/Business'
import { BusinessUserEvent } from '@/@types/openapi-public/BusinessUserEvent'
import { ConsumerUserEvent } from '@/@types/openapi-public/ConsumerUserEvent'
import { Transaction } from '@/@types/openapi-public/Transaction'
import { User } from '@/@types/openapi-public/User'
import { InternalTransaction } from '@/@types/openapi-internal/InternalTransaction'
import { InternalUser } from '@/@types/openapi-internal/InternalUser'
import { BatchResponseFailedRecord } from '@/@types/openapi-public/BatchResponseFailedRecord'
import { BatchResponseStatus } from '@/@types/openapi-public/BatchResponseStatus'
import { ConsumerUserEventWithRulesResult } from '@/@types/openapi-public/ConsumerUserEventWithRulesResult'
import { BusinessUserEventWithRulesResult } from '@/@types/openapi-public/BusinessUserEventWithRulesResult'
import { UserType } from '@/@types/user/user-type'

const ID_ALREADY_EXISTS = 'ID_ALREADY_EXISTS'
const ID_NOT_FOUND = 'ID_NOT_FOUND'
const RELATED_ID_NOT_FOUND = 'RELATED_ID_NOT_FOUND'
const ORIGIN_USER_ID_NOT_FOUND = 'ORIGIN_USER_ID_NOT_FOUND'
const DESTINATION_USER_ID_NOT_FOUND = 'DESTINATION_USER_ID_NOT_FOUND'
const DUPLICATE_ID_IN_BATCH = 'DUPLICATE_ID_IN_BATCH'
const EVENT_ALREADY_EXISTS = 'EVENT_ALREADY_EXISTS_WITH_SAME_TIMESTAMP_AND_ID'
type BatchImportErrorReason =
  | typeof ID_ALREADY_EXISTS
  | typeof DUPLICATE_ID_IN_BATCH
  | typeof RELATED_ID_NOT_FOUND
  | typeof ID_NOT_FOUND
  | typeof ORIGIN_USER_ID_NOT_FOUND
  | typeof DESTINATION_USER_ID_NOT_FOUND
  | typeof EVENT_ALREADY_EXISTS

type TransactionValidationOptions = {
  validateOriginUserId?: boolean
  validateDestinationUserId?: boolean
}

export class BatchImportService {
  private readonly transactionRepository: MongoDbTransactionRepository
  private readonly userRepository: UserRepository
  private readonly userEventRepository: UserEventRepository
  private readonly transactionEventRepository: TransactionEventRepository

  constructor(
    private readonly tenantId: string,
    readonly connections: {
      mongoDb: MongoClient
      dynamoDb: DynamoDBDocumentClient
    }
  ) {
    this.transactionRepository = new MongoDbTransactionRepository(
      this.tenantId,
      connections.mongoDb
    )
    this.userRepository = new UserRepository(this.tenantId, {
      mongoDb: connections.mongoDb,
      dynamoDb: connections.dynamoDb,
    })
    this.userEventRepository = new UserEventRepository(this.tenantId, {
      mongoDb: connections.mongoDb,
      dynamoDb: connections.dynamoDb,
    })
    this.transactionEventRepository = new TransactionEventRepository(
      this.tenantId,
      {
        mongoDb: connections.mongoDb,
        dynamoDb: connections.dynamoDb,
      }
    )
  }

  public async importTransactions(
    batchId: string,
    transactions: Transaction[],
    validationOptions?: TransactionValidationOptions
  ): Promise<BatchResponse> {
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
    const existingUsers = await this.userRepository.getMongoUsersByIds(
      allUserIds
    )
    const failedRecords: BatchResponseFailedRecord[] = []
    const idsCountMap = new Map<string, number>()
    for (const transaction of transactions) {
      idsCountMap.set(
        transaction.transactionId,
        (idsCountMap.get(transaction.transactionId) ?? 0) + 1
      )
    }
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
      }
    }
    return {
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
    }
  }

  private validateTransaction(
    transaction: Transaction,
    data: {
      existingTransactions: InternalTransaction[]
      existingRelatedTransactions: InternalTransaction[]
      existingUsers: InternalUser[]
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

  private async getTransactionEvents(transactionEvents: TransactionEvent[]) {
    const existingTransactionEvents = await Promise.all(
      transactionEvents.map((event) =>
        this.transactionEventRepository.getTransactionEvents(
          event.transactionId
        )
      )
    )
    return existingTransactionEvents
      .flatMap((e) => e)
      .filter((event) =>
        transactionEvents.find(
          (e) =>
            e.transactionId === event.transactionId &&
            e.timestamp === event.timestamp
        )
      )
  }

  public async importTransactionEvents(
    batchId: string,
    transactionEvents: TransactionEvent[]
  ): Promise<BatchResponse> {
    const relatedTransactionIds = compact(
      transactionEvents.flatMap(
        (t) => t.updatedTransactionAttributes?.relatedTransactionIds
      )
    )

    const [
      existingTransactions,
      existingRelatedTransactions,
      existingTransactionEvents,
    ] = await Promise.all([
      this.transactionRepository.getTransactionsByIds(
        transactionEvents.map((event) => event.transactionId)
      ),
      this.transactionRepository.getTransactionsByIds(relatedTransactionIds),
      this.getTransactionEvents(transactionEvents),
    ])

    const failedRecords: BatchResponseFailedRecord[] = []
    for (const transactionEvent of transactionEvents) {
      const validationError = this.validateTransactionEvent(transactionEvent, {
        existingTransactions,
        existingRelatedTransactions,
        existingTransactionEvents,
      })
      if (validationError) {
        failedRecords.push({
          id:
            validationError === ID_NOT_FOUND
              ? transactionEvent.transactionId
              : transactionEvent.eventId,
          reasonCode: validationError,
        })
      }
    }
    return {
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
    }
  }
  private validateTransactionEvent(
    transactionEvent: TransactionEvent,
    data: {
      existingTransactions: InternalTransaction[]
      existingRelatedTransactions: InternalTransaction[]
      existingTransactionEvents: TransactionEvent[]
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
      data.existingTransactionEvents.find(
        (e) =>
          e.transactionId === transactionEvent.transactionId &&
          e.timestamp === transactionEvent.timestamp
      )
    ) {
      return EVENT_ALREADY_EXISTS
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
  ): Promise<BatchResponse> {
    return this.importUsers(batchId, users)
  }

  public async importBusinessUsers(
    batchId: string,
    users: Business[]
  ): Promise<BatchResponse> {
    return this.importUsers(batchId, users)
  }

  private async importUsers(
    batchId: string,
    users: Array<User | Business>
  ): Promise<BatchResponse> {
    const existingUsers = await this.userRepository.getMongoUsersByIds(
      users.map((user) => user.userId)
    )
    const idsCountMap = new Map<string, number>()
    for (const user of users) {
      idsCountMap.set(user.userId, (idsCountMap.get(user.userId) ?? 0) + 1)
    }
    const parentUserIds = compact(
      users.map((user) => user.linkedEntities?.parentUserId)
    )
    const existingParentUsers = await this.userRepository.getMongoUsersByIds(
      parentUserIds
    )
    const failedRecords: BatchResponseFailedRecord[] = []
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
      }
    }
    return {
      status: this.getBatchResponseStatus(users.length, failedRecords.length),
      batchId,
      successful: users.length - failedRecords.length,
      failed: failedRecords.length,
      failedRecords:
        failedRecords.length > 0 ? uniqBy(failedRecords, 'id') : undefined,
      message: this.getBatchResponseMessage(users.length, failedRecords.length),
    }
  }

  private validateUser(
    user: User | Business,
    data: {
      existingUsers: InternalUser[]
      existingParentUsers: InternalUser[]
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
  ): Promise<BatchResponse> {
    return this.importUserEvents(batchId, userEvents, 'CONSUMER')
  }

  public async importBusinessUserEvents(
    batchId: string,
    userEvents: BusinessUserEvent[]
  ): Promise<BatchResponse> {
    return this.importUserEvents(batchId, userEvents, 'BUSINESS')
  }

  private async getUserEvents(
    userEvents: Array<ConsumerUserEvent | BusinessUserEvent>,
    userType: UserType
  ): Promise<
    (
      | ConsumerUserEventWithRulesResult
      | BusinessUserEventWithRulesResult
      | null
    )[]
  > {
    return await Promise.all(
      userEvents.map((event) =>
        this.userEventRepository.getUserEvent(
          userType,
          event.userId,
          event.timestamp
        )
      )
    )
  }

  private async importUserEvents(
    batchId: string,
    userEvents: Array<ConsumerUserEvent | BusinessUserEvent>,
    userType: UserType
  ): Promise<BatchResponse> {
    const parentUserIds = compact(
      userEvents.map(
        (event) =>
          (event as BusinessUserEvent).updatedBusinessUserAttributes
            ?.linkedEntities?.parentUserId ??
          (event as ConsumerUserEvent).updatedConsumerUserAttributes
            ?.linkedEntities?.parentUserId
      )
    )
    const [existingUsers, existingParentUsers, existingUserEvents] =
      await Promise.all([
        this.userRepository.getMongoUsersByIds(
          userEvents.map((event) => event.userId)
        ),
        this.userRepository.getMongoUsersByIds(parentUserIds),
        this.getUserEvents(userEvents, userType),
      ])

    const failedRecords: BatchResponseFailedRecord[] = []
    for (const userEvent of userEvents) {
      const validationError = this.validateUserEvent(userEvent, {
        existingUsers,
        existingParentUsers,
        existingUserEvents,
      })
      if (validationError) {
        failedRecords.push({
          id:
            validationError === ID_NOT_FOUND
              ? userEvent.userId
              : userEvent.eventId,
          reasonCode: validationError,
        })
      }
    }
    return {
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
    }
  }
  private validateUserEvent(
    userEvent: ConsumerUserEvent | BusinessUserEvent,
    data: {
      existingUsers: InternalUser[]
      existingParentUsers: InternalUser[]
      existingUserEvents: (
        | ConsumerUserEventWithRulesResult
        | BusinessUserEventWithRulesResult
        | null
      )[]
    }
  ): BatchImportErrorReason | null {
    if (!data.existingUsers.find((u) => u.userId === userEvent.userId)) {
      return ID_NOT_FOUND
    }
    if (
      data.existingUserEvents.find(
        (e) =>
          e?.userId === userEvent.userId && e?.timestamp === userEvent.timestamp
      )
    ) {
      return EVENT_ALREADY_EXISTS
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
