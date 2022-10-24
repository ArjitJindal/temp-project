import { KinesisStreamEvent } from 'aws-lambda'
import { lambdaConsumer } from '@/core/middlewares/lambda-consumer-middlewares'
import { logger } from '@/core/logger'
import { getMongoDbClient } from '@/utils/mongoDBUtils'
import { getDynamoDbUpdates } from '@/core/dynamodb/dynamodb-stream-utils'
import { RiskRepository } from '@/services/risk-scoring/repositories/risk-repository'
import { ArsItem, KrsItem } from '@/services/risk-scoring/types'

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
          await riskRepository.addKrsValueToMongo(newImage as KrsItem)
        }
        if (update.NewImage && update.entityId.includes('ARS_VALUE')) {
          logger.info(`Storing ARS in Mongo`)
          const mongoDb = await getMongoDbClient()
          const newImage = update.NewImage

          const riskRepository = new RiskRepository(update.tenantId, {
            mongoDb,
          })
          await riskRepository.addArsValueToMongo(newImage as ArsItem)
        }
      }
    } catch (err) {
      logger.error(err)
      return 'Internal error'
    }
  }
)
