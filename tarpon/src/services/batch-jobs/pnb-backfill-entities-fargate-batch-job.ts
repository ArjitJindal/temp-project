import * as readline from 'readline'
import { Readable } from 'stream'
import { GetObjectCommand } from '@aws-sdk/client-s3'
import pMap from 'p-map'
import { chunk, last, uniqBy } from 'lodash'
import { MongoClient, ObjectId } from 'mongodb'
import { StackConstants } from '@lib/constants'
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb'
import { DynamoDbTransactionRepository } from '../rules-engine/repositories/dynamodb-transaction-repository'
import { BatchJobRunner } from './batch-job-runner-base'
import { generateChecksum } from '@/utils/object'
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
  private progressKey!: string

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
    this.mongoDbConsumer = new MongoDbConsumer(this.mongoDb)

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
    const stream = Body instanceof Readable ? Body : Readable.from(Body as any)
    const rl = readline.createInterface({
      input: stream,
      crlfDelay: Infinity,
    })

    this.progressKey = `pnb-backfill-entities-${importFileS3Key}`
    const lastCompletedTimestamp = await getMigrationLastCompletedTimestamp(
      this.progressKey
    )

    let batchEntities: any[] = []
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
        await this.processBatch(batchEntities, type)
        logger.warn(`Processed ${batchEntities.length} entities`)
        batchEntities = []
      }
    }
    await this.processBatch(batchEntities, type)
  }

  private async processBatch(
    batchEntities: any[],
    type: 'TRANSACTION' | 'CONSUMER' | 'BUSINESS'
  ) {
    for (const entityChunk of chunk(batchEntities, 150)) {
      if (type === 'TRANSACTION') {
        await this.saveTransactions(entityChunk as Transaction[])
      } else {
        await this.saveUsers(entityChunk as Array<User | Business>, type)
      }
      const entity = last(entityChunk)
      await updateMigrationLastCompletedTimestamp(
        this.progressKey,
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
      if (e instanceof Error && e.message.includes('duplicate key error')) {
        return
      }
      logger.error(e)
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
    }
  }
}
