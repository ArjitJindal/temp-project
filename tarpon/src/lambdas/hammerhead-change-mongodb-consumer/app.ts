import path from 'path'
import { KinesisStreamEvent, SQSEvent } from 'aws-lambda'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import { TRANSACTIONS_COLLECTION } from '@/utils/mongodb-definitions'
import { lambdaConsumer } from '@/core/middlewares/lambda-consumer-middlewares'
import { logger } from '@/core/logger'
import { StreamConsumerBuilder } from '@/core/dynamodb/dynamodb-stream-consumer-builder'
import { ArsScore } from '@/@types/openapi-internal/ArsScore'
import { DrsScore } from '@/@types/openapi-internal/DrsScore'
import { KrsScore } from '@/@types/openapi-internal/KrsScore'
import { RiskRepository } from '@/services/risk-scoring/repositories/risk-repository'
import { UserRepository } from '@/services/users/repositories/user-repository'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { isDemoTenant } from '@/utils/tenant'
import { RuleInstance } from '@/@types/openapi-public-management/RuleInstance'
import { publishMetric } from '@/core/utils/context'
import { RULE_HIT_PERCENTAGE } from '@/core/cloudwatch/metrics'

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
async function ruleInstanceHandler(
  tenantId: string,
  ruleInstance: RuleInstance | undefined
) {
  if (!ruleInstance || isDemoTenant(tenantId)) {
    return
  }
  logger.info(`Processing Rule Instance`)
  const hitCount = ruleInstance.hitCount || 0
  const runCount = ruleInstance.runCount || 0
  const hitPercentage = (hitCount * 100) / runCount

  publishMetric(RULE_HIT_PERCENTAGE, hitPercentage, {
    tenantId,
    ruleInstanceid: ruleInstance.id,
  })

  logger.info(`Rule instance processed`)
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
  .setRuleInstanceHandler((tenantId, oldRuleInstance, newRuleInstance) =>
    ruleInstanceHandler(tenantId, newRuleInstance)
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
