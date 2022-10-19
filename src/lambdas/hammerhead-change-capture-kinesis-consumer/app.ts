import { KinesisStreamEvent } from 'aws-lambda'
import { lambdaConsumer } from '@/core/middlewares/lambda-consumer-middlewares'
import { logger } from '@/core/logger'
import { getMongoDbClient } from '@/utils/mongoDBUtils'
import { getDynamoDbUpdates } from '@/core/dynamodb/dynamodb-stream-utils'
import { RiskRepository } from '@/services/risk-scoring/repositories/risk-repository'
import { KrsItem } from '@/services/risk-scoring/types'

export const hammerheadChangeCaptureHandler = lambdaConsumer()(
  async (event: KinesisStreamEvent) => {
    try {
      for (const update of getDynamoDbUpdates(event)) {
        logger.info(`Storing KRS in Mongo`)
        if (update.NewImage && update.entityId.includes('KRS_VALUE')) {
          const mongoDb = await getMongoDbClient()
          const newImage = update.NewImage

          const riskRepository = new RiskRepository(update.tenantId, {
            mongoDb,
          })
          await riskRepository.addKrsValueToMongo(newImage as KrsItem)
        }
      }
    } catch (err) {
      logger.error(err)
      return 'Internal error'
    }
  }
)
