import path from 'path'
import { KinesisStreamEvent, SQSEvent } from 'aws-lambda'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import {
  CASES_COLLECTION,
  TRANSACTIONS_COLLECTION,
} from '@/utils/mongodb-definitions'
import { lambdaConsumer } from '@/core/middlewares/lambda-consumer-middlewares'
import { logger } from '@/core/logger'
import { StreamConsumerBuilder } from '@/core/dynamodb/dynamodb-stream-consumer-builder'
import { ArsScore } from '@/@types/openapi-internal/ArsScore'
import { DrsScore } from '@/@types/openapi-internal/DrsScore'
import { KrsScore } from '@/@types/openapi-internal/KrsScore'
import { RiskRepository } from '@/services/risk-scoring/repositories/risk-repository'
import { Case } from '@/@types/openapi-internal/Case'
import { UserRepository } from '@/services/users/repositories/user-repository'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { isDemoTenant } from '@/utils/tenant'

async function arsScoreEventHandler(
  tenantId: string,
  arsScore: ArsScore | undefined
) {
  if (!arsScore || isDemoTenant(tenantId)) {
    return
  }
  logger.info(`Processing ARS Score`)
  const mongoDb = await getMongoDbClient()

  const riskRepository = new RiskRepository(tenantId, {
    mongoDb,
  })

  const casesCollection = mongoDb
    .db()
    .collection<Case>(CASES_COLLECTION(tenantId))

  await Promise.all([
    riskRepository.addArsValueToMongo(arsScore),
    mongoDb
      .db()
      .collection(TRANSACTIONS_COLLECTION(tenantId))
      .updateOne(
        { transactionId: arsScore.transactionId },
        { $set: { arsScore } }
      ),
  ])

  const caseDocuments = await casesCollection
    .find({
      'caseTransactions.transactionId': arsScore.transactionId,
    })
    .toArray()

  await Promise.all(
    caseDocuments.map(async (caseDocument) => {
      const caseTransactions = caseDocument?.caseTransactions
      if (caseTransactions && caseTransactions?.length > 0) {
        const caseTransaction = caseTransactions.find(
          (transaction) => transaction.transactionId === arsScore.transactionId
        )
        if (caseTransaction) {
          caseTransaction.arsScore = arsScore
        }

        await casesCollection.updateOne(
          { _id: caseDocument._id },
          { $set: { caseTransactions } }
        )
      }
    })
  )

  logger.info(`ARS Score Processed`)
}

async function drsScoreEventHandler(
  tenantId: string,
  drsScore: DrsScore | undefined
) {
  if (!drsScore) {
    return
  }
  logger.info(`Processing DRS Score`)
  const mongoDb = await getMongoDbClient()
  const dynamoDb = getDynamoDbClient()

  const riskRepository = new RiskRepository(tenantId, { mongoDb })
  const userRepository = new UserRepository(tenantId, { mongoDb, dynamoDb })

  await Promise.all([
    riskRepository.addDrsValueToMongo(drsScore),
    drsScore.userId
      ? userRepository.updateDrsScoreOfUser(drsScore.userId, drsScore)
      : undefined,
  ])

  logger.info(`DRS Score Processed`)
}

async function krsScoreEventHandler(
  tenantId: string,
  krsScore: KrsScore | undefined
) {
  if (!krsScore || isDemoTenant(tenantId)) {
    return
  }
  logger.info(`Processing KRS Score`)
  const mongoDb = await getMongoDbClient()

  const riskRepository = new RiskRepository(tenantId, { mongoDb })
  const userRepository = new UserRepository(tenantId, { mongoDb })

  await Promise.all([
    riskRepository.addKrsValueToMongo(krsScore),
    krsScore.userId
      ? userRepository.updateKrsScoreOfUserMongo(krsScore.userId, krsScore)
      : undefined,
  ])

  logger.info(`KRS Score Processed`)
}

const hammerheadBuilder = new StreamConsumerBuilder(
  path.basename(__dirname) + '-hammerhead',
  process.env.HAMMERHEAD_CHANGE_CAPTURE_RETRY_QUEUE_URL!
)
  .setArsScoreEventHandler((tenantId, oldArsScore, newArsScore) =>
    arsScoreEventHandler(tenantId, newArsScore)
  )
  .setDrsScoreEventHandler((tenantId, oldDrsScore, newDrsScore) =>
    drsScoreEventHandler(tenantId, newDrsScore)
  )
  .setKrsScoreEventHandler((tenantId, oldKrsScore, newKrsScore) =>
    krsScoreEventHandler(tenantId, newKrsScore)
  )

const hammerheadKinesisHandler = hammerheadBuilder.buildKinesisStreamHandler()
const hammerheadSqsRetryHandler = hammerheadBuilder.buildSqsRetryHandler()

export const hammerheadChangeMongoDbHandler = lambdaConsumer()(
  async (event: KinesisStreamEvent) => {
    await hammerheadKinesisHandler(event)
  }
)

export const hammerheadChangeMongoDbRetryHandler = lambdaConsumer()(
  async (event: SQSEvent) => {
    await hammerheadSqsRetryHandler(event)
  }
)
