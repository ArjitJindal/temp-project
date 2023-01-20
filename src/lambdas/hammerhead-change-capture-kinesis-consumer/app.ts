import { KinesisStreamEvent } from 'aws-lambda'
import { lambdaConsumer } from '@/core/middlewares/lambda-consumer-middlewares'
import { logger } from '@/core/logger'
import {
  CASES_COLLECTION,
  getMongoDbClient,
  TRANSACTIONS_COLLECTION,
  USERS_COLLECTION,
} from '@/utils/mongoDBUtils'
import { getDynamoDbUpdates } from '@/core/dynamodb/dynamodb-stream-utils'
import { RiskRepository } from '@/services/risk-scoring/repositories/risk-repository'
import { Business } from '@/@types/openapi-public/Business'
import { User } from '@/@types/openapi-public/User'
import { KrsScore } from '@/@types/openapi-internal/KrsScore'
import { ArsScore } from '@/@types/openapi-internal/ArsScore'
import { DrsScore } from '@/@types/openapi-internal/DrsScore'
import { Case } from '@/@types/openapi-internal/Case'

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
          const newImage = update.NewImage as ArsScore

          const riskRepository = new RiskRepository(update.tenantId, {
            mongoDb,
          })
          await riskRepository.addArsValueToMongo(newImage as ArsScore)

          await mongoDb
            .db()
            .collection(TRANSACTIONS_COLLECTION(update.tenantId))
            .updateOne(
              { transactionId: newImage.transactionId },
              { $set: { arsScore: newImage } }
            )

          const casesCollection = mongoDb
            .db()
            .collection<Case>(CASES_COLLECTION(update.tenantId))

          const caseDocuments = await casesCollection
            .find({ 'caseTransactions.transactionId': newImage.transactionId })
            .toArray()

          for (const caseDocument of caseDocuments) {
            const caseTransactions = caseDocument?.caseTransactions
            if (caseTransactions && caseTransactions?.length > 0) {
              const caseTransaction = caseTransactions.find(
                (transaction) =>
                  transaction.transactionId === newImage.transactionId
              )
              if (caseTransaction) {
                caseTransaction.arsScore = newImage
              }

              await casesCollection.updateOne(
                { _id: caseDocument._id },
                { $set: { caseTransactions } }
              )
            }
          }
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
