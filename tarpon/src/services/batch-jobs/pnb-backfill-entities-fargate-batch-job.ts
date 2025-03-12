import { GetObjectCommand } from '@aws-sdk/client-s3'
import pMap from 'p-map'
import { chunk, last, uniqBy } from 'lodash'
import { MongoClient, ObjectId } from 'mongodb'
import { StackConstants } from '@lib/constants'
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb'
import { v4 as uuidv4 } from 'uuid'
import { DynamoDbTransactionRepository } from '../rules-engine/repositories/dynamodb-transaction-repository'
import { UserRepository } from '../users/repositories/user-repository'
import { BatchJobRunner } from './batch-job-runner-base'
import {
  generateChecksum,
  mergeEntities,
  pickKnownEntityFields,
} from '@/utils/object'
import {
  getMigrationLastCompletedTimestamp,
  updateMigrationLastCompletedTimestamp,
} from '@/utils/migration-progress'
import { PnbBackfillEntities } from '@/@types/batch-job'
import { getS3Client } from '@/utils/s3'
import { Transaction } from '@/@types/openapi-public/Transaction'
import { Business } from '@/@types/openapi-public/Business'
import { User } from '@/@types/openapi-public/User'
import {
  batchWrite,
  BatchWriteRequestInternal,
  getDynamoDbClient,
} from '@/utils/dynamodb'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import { DynamoDbKeys, getPaymentMethodId } from '@/core/dynamodb/dynamodb-keys'
import { InternalTransaction } from '@/@types/openapi-internal/InternalTransaction'
import {
  TRANSACTIONS_COLLECTION,
  USERS_COLLECTION,
} from '@/utils/mongodb-definitions'
import { MongoDbConsumer } from '@/lambdas/mongo-db-trigger-consumer'
import { logger } from '@/core/logger'
import { isClickhouseEnabledInRegion } from '@/utils/clickhouse/utils'
import { ConsumerUserEvent } from '@/@types/openapi-internal/ConsumerUserEvent'
import { UserOptional } from '@/@types/openapi-internal/UserOptional'
import { BusinessUserEvent } from '@/@types/openapi-internal/BusinessUserEvent'
import { BusinessOptional } from '@/@types/openapi-internal/BusinessOptional'
import { TransactionEvent } from '@/@types/openapi-public/TransactionEvent'
import { TransactionWithRulesResult } from '@/@types/openapi-internal/TransactionWithRulesResult'

const RULES_RESULT = {
  executedRules: [] as any,
  hitRules: [] as any,
  status: 'ALLOW' as const,
}

export class PnbBackfillEntitiesBatchJobRunner extends BatchJobRunner {
  private dynamoDbTransactionRepository!: DynamoDbTransactionRepository
  private mongoDbConsumer!: MongoDbConsumer
  private dynamoDbOnly: boolean = false
  private mongoDb!: MongoClient
  private dynamoDb!: DynamoDBDocumentClient
  private tenantId!: string
  private userRepository!: UserRepository

  protected async run(job: PnbBackfillEntities): Promise<void> {
    const { tenantId } = job
    const { type, importFileS3Key, dynamoDbOnly } = job.parameters

    this.dynamoDb = getDynamoDbClient()
    this.mongoDb = await getMongoDbClient()
    this.dynamoDbOnly = dynamoDbOnly
    this.tenantId = tenantId
    this.dynamoDbTransactionRepository = new DynamoDbTransactionRepository(
      tenantId,
      this.dynamoDb
    )
    this.mongoDbConsumer = new MongoDbConsumer(this.mongoDb, this.dynamoDb)
    this.userRepository = new UserRepository(this.tenantId, {
      mongoDb: this.mongoDb,
      dynamoDb: this.dynamoDb,
    })

    await this.mongoDb
      .db()
      .collection(TRANSACTIONS_COLLECTION(tenantId))
      .createIndex({ transactionId: 1 }, { unique: true })
    await this.mongoDb
      .db()
      .collection(USERS_COLLECTION(tenantId))
      .createIndex({ userId: 1 }, { unique: true })

    const s3 = getS3Client()
    const { Body } = await s3.send(
      new GetObjectCommand({
        Bucket: process.env.IMPORT_BUCKET,
        Key: importFileS3Key,
      })
    )
    const stream = (Body as any)?.transformToWebStream()
    const reader = stream.getReader()
    const decoder = new TextDecoder()
    const rl = {
      async *[Symbol.asyncIterator]() {
        let leftover = ''
        while (true) {
          const { done, value } = await reader.read()
          if (done) {
            if (leftover) {
              yield leftover
            }
            break
          }
          const chunk = decoder.decode(value, { stream: true })
          const lines = (leftover + chunk).split('\n')
          leftover = lines.pop() || ''
          for (const line of lines) {
            if (line) {
              yield line
            }
          }
        }
      },
    }
    const lastCompletedTimestamp = await getMigrationLastCompletedTimestamp(
      this.jobId
    )

    let batchEntities: any[] = []
    let count = 0
    for await (const line of rl) {
      const jsonData = JSON.parse(line)
      const timestamp = jsonData.timestamp ?? jsonData.createdTimestamp
      if (
        timestamp &&
        lastCompletedTimestamp &&
        timestamp < lastCompletedTimestamp
      ) {
        continue
      }

      batchEntities.push(jsonData)
      if (batchEntities.length === 10000) {
        count += batchEntities.length
        await this.processBatch(batchEntities, type)
        logger.warn(`Processed ${count} entities`)
        batchEntities = []
      }
    }
    if (batchEntities.length > 0) {
      count += batchEntities.length
      await this.processBatch(batchEntities, type)
      logger.warn(`Processed ${count} entities`)
    }
  }

  private async processBatch(
    batchEntities: any[],
    type:
      | 'TRANSACTION'
      | 'CONSUMER'
      | 'BUSINESS'
      | 'TRANSACTION_EVENT'
      | 'CONSUMER_EVENT'
      | 'BUSINESS_EVENT'
  ) {
    for (const entityChunk of chunk(batchEntities, 150)) {
      if (type === 'TRANSACTION') {
        await this.saveTransactions(entityChunk as Transaction[])
      } else if (type === 'CONSUMER' || type === 'BUSINESS') {
        await this.saveUsers(entityChunk as Array<User | Business>, type)
      } else if (type === 'CONSUMER_EVENT' || type === 'BUSINESS_EVENT') {
        await this.saveUserEvents(
          entityChunk as (ConsumerUserEvent | BusinessUserEvent)[]
        )
      } else if (type === 'TRANSACTION_EVENT') {
        await this.updateTransactionEvents(entityChunk as TransactionEvent[])
      }
      const entity = last(entityChunk)
      await updateMigrationLastCompletedTimestamp(
        this.jobId,
        entity.timestamp || entity.createdTimestamp
      )
    }
  }

  private async saveTransactions(transactions: Transaction[]) {
    transactions = uniqBy(transactions, 'transactionId')
    let optionalPromise: Promise<any> = Promise.resolve()
    if (!this.dynamoDbOnly) {
      const internalTransactions: Array<
        InternalTransaction & {
          _id: ObjectId
        }
      > = transactions.map((transaction) => ({
        ...transaction,
        ...RULES_RESULT,
        _id: new ObjectId(generateChecksum(transaction.transactionId, 24)),
        originPaymentMethodId: getPaymentMethodId(
          transaction.originPaymentDetails
        ),
        destinationPaymentMethodId: getPaymentMethodId(
          transaction.destinationPaymentDetails
        ),
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }))
      optionalPromise = (async () => {
        await this.mongoDb
          .db()
          .collection(TRANSACTIONS_COLLECTION(this.tenantId))
          .insertMany(internalTransactions, { ordered: false })
        if (isClickhouseEnabledInRegion()) {
          await this.mongoDbConsumer.handleMessagesReplace({
            [TRANSACTIONS_COLLECTION(this.tenantId)]: internalTransactions.map(
              (transaction) => {
                return {
                  collectionName: TRANSACTIONS_COLLECTION(this.tenantId),
                  operationType: 'replace',
                  documentKey: {
                    value: transaction._id.toString(),
                    type: 'id',
                  },
                  clusterTime: Date.now(),
                }
              }
            ),
          })
        }
      })()
    }

    try {
      await Promise.all([
        pMap(
          transactions,
          async (transaction) => {
            await this.dynamoDbTransactionRepository.saveTransaction(
              transaction,
              RULES_RESULT
            )
          },
          { concurrency: 10 }
        ),
        optionalPromise,
      ])
    } catch (e) {
      if (
        e instanceof Error &&
        (e as Error).message.includes('duplicate key error')
      ) {
        return
      }
      logger.error(e)
      await this.mongoDb
        .db()
        .collection('backfill-failure')
        .insertMany(
          transactions.map((transaction) => ({
            job: 'PNB_BACKFILL_ENTITIES',
            tenantId: this.tenantId,
            transactionId: transaction.transactionId,
            reason: (e as Error).message,
          }))
        )
    }
  }

  private async saveUsers(
    users: Array<User | Business>,
    type: 'CONSUMER' | 'BUSINESS'
  ) {
    users = uniqBy(users, 'userId')
    users.forEach((user) => {
      const employmentDetails = (user as User).employmentDetails
      // Fix typo
      if (employmentDetails && (employmentDetails as any).employmerName) {
        employmentDetails.employerName = (
          employmentDetails as any
        ).employmerName
        delete (employmentDetails as any).employmerName
      }
    })

    let optionalPromise: Promise<any> = Promise.resolve()
    if (!this.dynamoDbOnly) {
      const internalUsers: Array<
        (User | Business) & {
          _id: ObjectId
        }
      > = users.map((user) => ({
        ...user,
        _id: new ObjectId(generateChecksum(user.userId, 24)),
        type,
        ...RULES_RESULT,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }))
      optionalPromise = (async () => {
        await this.mongoDb
          .db()
          .collection(USERS_COLLECTION(this.tenantId))
          .insertMany(internalUsers, { ordered: false })
        if (isClickhouseEnabledInRegion()) {
          await this.mongoDbConsumer.handleMessagesReplace({
            [USERS_COLLECTION(this.tenantId)]: internalUsers.map((user) => ({
              collectionName: USERS_COLLECTION(this.tenantId),
              operationType: 'replace',
              documentKey: {
                value: user._id.toString(),
                type: 'id',
              },
              clusterTime: Date.now(),
            })),
          })
        }
      })()
    }

    const writeRequests: BatchWriteRequestInternal[] = users.map((user) => {
      return {
        PutRequest: {
          Item: {
            ...DynamoDbKeys.USER(this.tenantId, user.userId),
            ...user,
            type,
            ...RULES_RESULT,
          },
        },
      }
    })

    try {
      await Promise.all([
        batchWrite(
          this.dynamoDb,
          writeRequests,
          StackConstants.TARPON_DYNAMODB_TABLE_NAME(this.tenantId)
        ),
        optionalPromise,
      ])
    } catch (e) {
      if (e instanceof Error && e.message.includes('duplicate key error')) {
        return
      }
      logger.error(e)
      await this.mongoDb
        .db()
        .collection('backfill-failure')
        .insertMany(
          users.map((user) => ({
            job: 'PNB_BACKFILL_ENTITIES',
            tenantId: this.tenantId,
            userId: user.userId,
            reason: (e as Error).message,
          }))
        )
    }
  }

  private mergeConsumerUserAttributes = (
    user: User,
    userEvent: UserOptional
  ) => {
    return mergeEntities(
      user,
      pickKnownEntityFields<UserOptional>(userEvent, UserOptional)
    )
  }

  private mergeBusinessUserAttributes = (
    user: Business,
    userEvent: BusinessOptional
  ) => {
    return mergeEntities(
      user,
      pickKnownEntityFields<BusinessOptional>(userEvent, BusinessOptional)
    )
  }

  private async saveUserEvents(
    userEvents: (ConsumerUserEvent | BusinessUserEvent)[]
  ) {
    userEvents.forEach((userEvent) => {
      if (!userEvent.eventId) {
        userEvent.eventId = uuidv4()
      }
    })
    userEvents = uniqBy(userEvents, 'eventId')

    const batchWriteRequests: BatchWriteRequestInternal[] = []

    await pMap(
      userEvents,
      async (userEvent) => {
        const eventId = userEvent.eventId || uuidv4()
        const userId = userEvent.userId
        const user = await this.userRepository.getUser(userId)

        if (!user) {
          logger.warn(`User ${userId} not found`)
          return
        }

        let updatedUser: User | Business | undefined

        if (
          'updatedConsumerUserAttributes' in userEvent &&
          userEvent.updatedConsumerUserAttributes
        ) {
          updatedUser = this.mergeConsumerUserAttributes(
            user as User,
            userEvent.updatedConsumerUserAttributes
          )
        } else if (
          'updatedBusinessUserAttributes' in userEvent &&
          userEvent.updatedBusinessUserAttributes
        ) {
          updatedUser = this.mergeBusinessUserAttributes(
            user as Business,
            userEvent.updatedBusinessUserAttributes
          )
        }

        if (updatedUser) {
          batchWriteRequests.push({
            PutRequest: {
              Item: {
                ...DynamoDbKeys.USER(this.tenantId, userId),
                ...updatedUser,
              },
            },
          })
        }

        batchWriteRequests.push({
          PutRequest: {
            Item: {
              ...('updatedConsumerUserAttributes' in userEvent
                ? DynamoDbKeys.CONSUMER_USER_EVENT(
                    this.tenantId,
                    userId,
                    userEvent.timestamp
                  )
                : DynamoDbKeys.BUSINESS_USER_EVENT(
                    this.tenantId,
                    userId,
                    userEvent.timestamp
                  )),
              ...userEvent,
              eventId,
            },
          },
        })
      },
      { concurrency: 100 }
    )

    await batchWrite(
      this.dynamoDb,
      batchWriteRequests,
      StackConstants.TARPON_DYNAMODB_TABLE_NAME(this.tenantId)
    )
  }

  private async updateTransactionEvents(transactionEvents: TransactionEvent[]) {
    transactionEvents.forEach((transactionEvent) => {
      if (!transactionEvent.eventId) {
        transactionEvent.eventId = uuidv4()
      }
    })
    transactionEvents = uniqBy(transactionEvents, 'eventId')

    const batchWriteRequests: BatchWriteRequestInternal[] = []

    await pMap(
      transactionEvents,
      async (transactionEvent) => {
        const eventId = transactionEvent.eventId || uuidv4()
        const transaction =
          await this.dynamoDbTransactionRepository.getTransactionById(
            transactionEvent.transactionId
          )
        if (!transaction) {
          logger.warn(`Transaction ${transactionEvent.transactionId} not found`)
          return
        }

        const updatedTransaction = mergeEntities(
          {
            ...transaction,
            transactionState: transactionEvent.transactionState,
          },
          transactionEvent.updatedTransactionAttributes || {}
        ) as TransactionWithRulesResult

        batchWriteRequests.push({
          PutRequest: {
            Item: {
              ...DynamoDbKeys.TRANSACTION(
                this.tenantId,
                transactionEvent.transactionId
              ),
              ...updatedTransaction,
            },
          },
        })

        batchWriteRequests.push({
          PutRequest: {
            Item: {
              ...DynamoDbKeys.TRANSACTION_EVENT(
                this.tenantId,
                transactionEvent.transactionId,
                {
                  timestamp: transactionEvent.timestamp,
                  eventId,
                }
              ),
              ...transactionEvent,
              eventId,
            },
          },
        })
      },
      {
        concurrency: 100,
      }
    )

    await batchWrite(
      this.dynamoDb,
      batchWriteRequests,
      StackConstants.TARPON_DYNAMODB_TABLE_NAME(this.tenantId)
    )
  }
}
