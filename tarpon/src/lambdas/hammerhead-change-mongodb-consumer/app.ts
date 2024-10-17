import path from 'path'
import { KinesisStreamEvent, SQSEvent } from 'aws-lambda'
import { omit } from 'lodash'
import { StackConstants } from '@lib/constants'
import { getRiskLevelFromScore } from '@flagright/lib/utils'
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
import { AverageArsScore } from '@/@types/openapi-internal/AverageArsScore'
import { sendWebhookTasks } from '@/services/webhook/utils'

export async function arsScoreEventHandler(
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

export async function drsScoreEventHandler(
  tenantId: string,
  oldDrsScore: DrsScore | undefined,
  newDrsScore: DrsScore | undefined,
  dbClients: DbClients
) {
  if (!newDrsScore) {
    return
  }
  logger.info(`Processing DRS Score`)
  const { mongoDb, dynamoDb } = dbClients

  const riskRepository = new RiskRepository(tenantId, { mongoDb, dynamoDb })
  const userRepository = new UserRepository(tenantId, { mongoDb, dynamoDb })

  newDrsScore = omit(newDrsScore, DYNAMO_KEYS) as DrsScore

  if (newDrsScore.triggeredBy !== 'PUBLIC_API') {
    const riskClassificationValues =
      await riskRepository.getRiskClassificationValues()

    const oldRiskLevel = getRiskLevelFromScore(
      riskClassificationValues,
      oldDrsScore?.drsScore ?? null
    )

    const newRiskLevel = getRiskLevelFromScore(
      riskClassificationValues,
      newDrsScore.drsScore
    )
    if (!oldDrsScore || oldRiskLevel !== newRiskLevel) {
      await sendWebhookTasks(tenantId, [
        {
          event: 'CRA_RISK_LEVEL_UPDATED',
          payload: {
            riskLevel: newRiskLevel,
            userId: newDrsScore.userId,
          },
          triggeredBy:
            newDrsScore.triggeredBy === 'CONSOLE' ? 'MANUAL' : 'SYSTEM',
        },
      ])
    }
  }

  await Promise.all([
    riskRepository.addDrsValueToMongo(newDrsScore),
    newDrsScore.userId
      ? userRepository.updateDrsScoreOfUser(newDrsScore.userId, newDrsScore)
      : undefined,
  ])

  logger.info(`DRS Score Processed`)
}

export async function krsScoreEventHandler(
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

export async function avgArsScoreEventHandler(
  tenantId: string,
  newAvgArs: AverageArsScore | undefined,
  dbClients: DbClients
) {
  if (!newAvgArs) {
    return
  }
  logger.info(`Processing AVG ARS Score`)
  const { mongoDb } = dbClients

  const userRepository = new UserRepository(tenantId, { mongoDb })

  newAvgArs = omit(newAvgArs, DYNAMO_KEYS) as AverageArsScore

  await userRepository.updateAvgTrsScoreOfUser(
    newAvgArs.userId,
    omit(newAvgArs)
  )
  logger.info(`AVG ARS Score Processed`)
}

if (envIsNot('test', 'local') && !process.env.HAMMERHEAD_QUEUE_URL) {
  throw new Error('HAMMERHEAD_QUEUE_URL is not defined')
}

// TODO: Remove Hammerhead change handler in next PR so that we will eventually phase out hammerhead once we have 0 traffic on it
const hammerheadBuilder = new StreamConsumerBuilder(
  path.basename(__dirname) + '-hammerhead',
  process.env.HAMMERHEAD_QUEUE_URL ?? '',
  StackConstants.HAMMERHEAD_DYNAMODB_TABLE_NAME
)
  .setConcurrentGroupBy((update) => update.entityId ?? '')
  .setArsScoreEventHandler((tenantId, oldArsScore, newArsScore, dbClients) =>
    arsScoreEventHandler(tenantId, newArsScore, dbClients)
  )
  .setDrsScoreEventHandler((tenantId, oldDrsScore, newDrsScore, dbClients) =>
    drsScoreEventHandler(tenantId, oldDrsScore, newDrsScore, dbClients)
  )
  .setKrsScoreEventHandler((tenantId, oldKrsScore, newKrsScore, dbClients) =>
    krsScoreEventHandler(tenantId, newKrsScore, dbClients)
  )
  .setAvgArsScoreEventHandler((tenantId, oldAvgArs, newAvgArs, dbClients) =>
    avgArsScoreEventHandler(tenantId, newAvgArs, dbClients)
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
