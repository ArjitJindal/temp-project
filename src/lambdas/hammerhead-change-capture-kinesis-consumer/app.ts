import { KinesisStreamEvent } from 'aws-lambda'
import { lambdaConsumer } from '@/core/middlewares/lambda-consumer-middlewares'
import { logger } from '@/core/logger'
import { getMongoDbClient, USERS_COLLECTION } from '@/utils/mongoDBUtils'
import { getDynamoDbUpdates } from '@/core/dynamodb/dynamodb-stream-utils'
import { RiskRepository } from '@/services/risk-scoring/repositories/risk-repository'
import { Business } from '@/@types/openapi-public/Business'
import { User } from '@/@types/openapi-public/User'
import { KrsScore } from '@/@types/openapi-internal/KrsScore'
import { ArsScore } from '@/@types/openapi-internal/ArsScore'
import { DrsScore } from '@/@types/openapi-internal/DrsScore'

// TODO (FDT-45408): Refactor to use dynamodb-stream-consumer-builder

export const hammerheadChangeCaptureHandler = lambdaConsumer()(
  async (event: KinesisStreamEvent) => {
    try {
      for (const update of getDynamoDbUpdates(event)) {
        if (update.NewImage && update.entityId.includes('KRS_VALUE')) {
          logger.info(`Storing KRS in Mongo`)
          const mongoDb = await getMongoDbClient()
          const newImage = update.NewImage

          const riskRepository = new RiskRepository(update.tenantId, {
            mongoDb,
          })
          await riskRepository.addKrsValueToMongo(newImage as KrsScore)
        }
        if (update.NewImage && update.entityId.includes('ARS_VALUE')) {
          logger.info(`Storing ARS in Mongo`)
          const mongoDb = await getMongoDbClient()
          const newImage = update.NewImage

          const riskRepository = new RiskRepository(update.tenantId, {
            mongoDb,
          })
          await riskRepository.addArsValueToMongo(newImage as ArsScore)
        }
        if (update.NewImage && update.entityId.includes('DRS_VALUE')) {
          logger.info(`Storing DRS in Mongo`)
          const mongoDb = await getMongoDbClient()
          const drsScore = update.NewImage as DrsScore

          const riskRepository = new RiskRepository(update.tenantId, {
            mongoDb,
          })
          await riskRepository.addDrsValueToMongo(drsScore)

          const userCollection = mongoDb
            .db()
            .collection<Business | User>(USERS_COLLECTION(update.tenantId))
          await userCollection.updateOne(
            { userId: drsScore.userId },
            {
              $set: { drsScore },
            }
          )
        }
      }
    } catch (err) {
      logger.error(err)
      return 'Internal error'
    }
  }
)
