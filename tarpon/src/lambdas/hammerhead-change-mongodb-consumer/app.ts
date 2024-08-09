import path from 'path'
import { KinesisStreamEvent, SQSEvent } from 'aws-lambda'
import { omit } from 'lodash'
import { StackConstants } from '@lib/constants'
import { lambdaConsumer } from '@/core/middlewares/lambda-consumer-middlewares'
import { logger } from '@/core/logger'
import {
  DbClients,
  StreamConsumerBuilder,
} from '@/core/dynamodb/dynamodb-stream-consumer-builder'
import { ArsScore } from '@/@types/openapi-internal/ArsScore'
import { DrsScore } from '@/@types/openapi-internal/DrsScore'
import { KrsScore } from '@/@types/openapi-internal/KrsScore'
import { RiskRepository } from '@/services/risk-scoring/repositories/risk-repository'
import { UserRepository } from '@/services/users/repositories/user-repository'
import { isDemoTenant } from '@/utils/tenant'
import { MongoDbTransactionRepository } from '@/services/rules-engine/repositories/mongodb-transaction-repository'
import { DYNAMO_KEYS } from '@/core/seed/dynamodb'
import { envIsNot } from '@/utils/env'

async function arsScoreEventHandler(
  tenantId: string,
  arsScore: ArsScore | undefined,
  dbClients: DbClients
) {
  const transactionId = arsScore?.transactionId
  if (!arsScore || isDemoTenant(tenantId) || !transactionId) {
    return
  }
  logger.info(`Processing ARS Score`)
  const { mongoDb } = dbClients

  const riskRepository = new RiskRepository(tenantId, {
    mongoDb,
  })

  const transactionRepository = new MongoDbTransactionRepository(
    tenantId,
    mongoDb
  )

  arsScore = omit(arsScore, DYNAMO_KEYS) as ArsScore

  await Promise.all([
    riskRepository.addArsValueToMongo(arsScore),
    transactionRepository.updateArsScore(transactionId, arsScore), // If transaction id does not exist, it will not result in an error
  ])

  logger.info(`ARS Score Processed`)
}

async function drsScoreEventHandler(
  tenantId: string,
  drsScore: DrsScore | undefined,
  dbClients: DbClients
) {
  if (!drsScore) {
    return
  }
  logger.info(`Processing DRS Score`)
  const { mongoDb, dynamoDb } = dbClients

  const riskRepository = new RiskRepository(tenantId, { mongoDb })
  const userRepository = new UserRepository(tenantId, { mongoDb, dynamoDb })

  drsScore = omit(drsScore, DYNAMO_KEYS) as DrsScore

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
  krsScore: KrsScore | undefined,
  dbClients: DbClients
) {
  if (!krsScore || isDemoTenant(tenantId)) {
    return
  }
  logger.info(`Processing KRS Score`)
  const { mongoDb } = dbClients

  const riskRepository = new RiskRepository(tenantId, { mongoDb })
  const userRepository = new UserRepository(tenantId, { mongoDb })

  krsScore = omit(krsScore, DYNAMO_KEYS) as KrsScore

  await Promise.all([
    riskRepository.addKrsValueToMongo(krsScore),
    krsScore.userId
      ? userRepository.updateKrsScoreOfUserMongo(krsScore.userId, krsScore)
      : undefined,
  ])

  logger.info(`KRS Score Processed`)
}

if (envIsNot('test') && !process.env.HAMMERHEAD_QUEUE_URL) {
  throw new Error('HAMMERHEAD_QUEUE_URL is not defined')
}

const hammerheadBuilder = new StreamConsumerBuilder(
  path.basename(__dirname) + '-hammerhead',
  process.env.HAMMERHEAD_QUEUE_URL ?? '',
  StackConstants.HAMMERHEAD_DYNAMODB_TABLE_NAME
)
  .setArsScoreEventHandler((tenantId, oldArsScore, newArsScore, dbClients) =>
    arsScoreEventHandler(tenantId, newArsScore, dbClients)
  )
  .setDrsScoreEventHandler((tenantId, oldDrsScore, newDrsScore, dbClients) =>
    drsScoreEventHandler(tenantId, newDrsScore, dbClients)
  )
  .setKrsScoreEventHandler((tenantId, oldKrsScore, newKrsScore, dbClients) =>
    krsScoreEventHandler(tenantId, newKrsScore, dbClients)
  )

const hammerheadKinesisHandler = hammerheadBuilder.buildKinesisStreamHandler()
const hammerheadSqsFanOutHandler = hammerheadBuilder.buildSqsFanOutHandler()

export const hammerheadChangeMongoDbHandler = lambdaConsumer()(
  async (event: KinesisStreamEvent) => {
    await hammerheadKinesisHandler(event)
  }
)

export const hammerheadQueueHandler = lambdaConsumer()(
  async (event: SQSEvent) => {
    await hammerheadSqsFanOutHandler(event)
  }
)
