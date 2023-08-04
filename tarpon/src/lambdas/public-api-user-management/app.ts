import { Credentials } from '@aws-sdk/client-sts'
import {
  APIGatewayEventLambdaAuthorizerContext,
  APIGatewayProxyWithLambdaAuthorizerEvent,
} from 'aws-lambda'
import { NotFound } from 'http-errors'
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb'
import { MongoClient } from 'mongodb'
import { logger } from '@/core/logger'
import { UserRepository } from '@/services/users/repositories/user-repository'
import { getDynamoDbClientByEvent } from '@/utils/dynamodb'
import { lambdaApi } from '@/core/middlewares/lambda-api-middlewares'
import { RiskRepository } from '@/services/risk-scoring/repositories/risk-repository'
import { User } from '@/@types/openapi-public/User'
import { Business } from '@/@types/openapi-public/Business'
import { RiskScoringService } from '@/services/risk-scoring'
import { hasFeature, updateLogMetadata } from '@/core/utils/context'
import { getMongoDbClient } from '@/utils/mongoDBUtils'
import { UserManagementService } from '@/services/users'
import { pickKnownEntityFields } from '@/utils/object'
import {
  getRiskLevelFromScore,
  getRiskScoreFromLevel,
} from '@/services/risk-scoring/utils'
import { RiskLevel } from '@/@types/openapi-internal/RiskLevel'
import { ConsumerUsersResponse } from '@/@types/openapi-public/ConsumerUsersResponse'

const handleRiskLevelParam = async (
  tenantId: string,
  dynamoDb: DynamoDBDocumentClient,
  userPayload: User | Business,
  mongoDb: MongoClient
) => {
  const riskRepository = new RiskRepository(tenantId, { dynamoDb, mongoDb })
  await riskRepository.createOrUpdateManualDRSRiskItem(
    userPayload.userId,
    userPayload.riskLevel!
  )
  delete userPayload.riskLevel
}

export const userHandler = lambdaApi()(
  async (
    event: APIGatewayProxyWithLambdaAuthorizerEvent<
      APIGatewayEventLambdaAuthorizerContext<Credentials>
    >
  ) => {
    const { principalId: tenantId } = event.requestContext.authorizer
    const dynamoDb = getDynamoDbClientByEvent(event)
    const mongoDb = await getMongoDbClient()
    const userRepository = new UserRepository(tenantId, {
      dynamoDb: dynamoDb,
      mongoDb,
    })
    const userId = event.pathParameters?.userId
    const isConsumerUser = event.path.includes('consumer')

    if (event.httpMethod === 'GET' && userId) {
      const user = isConsumerUser
        ? await userRepository.getConsumerUserWithRiskScores(userId)
        : await userRepository.getBusinessUserWithRiskScores(userId)

      if (!user) {
        throw new NotFound(`User ${userId} not found`)
      }

      return user
    } else if (event.httpMethod === 'POST' && event.body) {
      const userPayload = pickKnownEntityFields(
        JSON.parse(event.body),
        isConsumerUser ? User : Business
      ) as User | Business

      updateLogMetadata({ userId: userPayload.userId })
      logger.info(`Processing User`) // Need to log to show on the logs

      if (userPayload.userId) {
        const user = isConsumerUser
          ? await userRepository.getConsumerUserWithRiskScores(
              userPayload.userId as string
            )
          : await userRepository.getBusinessUserWithRiskScores(
              userPayload.userId as string
            )

        if (user) {
          return {
            userId: user.userId,
            message:
              'The provided userId already exists. The user attribute updates are not saved. If you want to update the attributes of this user, please use user events instead.',
            riskScoreDetails: user.riskScoreDetails,
          }
        }
      }

      let krsScore: number | undefined
      let craScore: number | undefined
      let krsRiskLevel: RiskLevel | undefined
      let craRiskLevel: RiskLevel | undefined

      if (hasFeature('PULSE')) {
        const riskScoringService = new RiskScoringService(tenantId, {
          dynamoDb,
          mongoDb,
        })
        const score = await riskScoringService.updateInitialRiskScores(
          userPayload as User | Business
        )

        krsScore = craScore = score
        const riskRepository = new RiskRepository(tenantId, {
          dynamoDb,
          mongoDb,
        })

        const riskClassificationValues =
          await riskRepository.getRiskClassificationValues()

        const riskLevel = getRiskLevelFromScore(riskClassificationValues, score)

        krsRiskLevel = riskLevel
        craRiskLevel = riskLevel

        const preDefinedRiskLevel = userPayload.riskLevel

        if (preDefinedRiskLevel) {
          await handleRiskLevelParam(
            tenantId,
            dynamoDb,
            userPayload as User | Business,
            mongoDb
          )

          craScore = getRiskScoreFromLevel(
            riskClassificationValues,
            preDefinedRiskLevel
          )

          craRiskLevel = preDefinedRiskLevel
        }
      }

      const userManagementService = new UserManagementService(
        tenantId,
        dynamoDb,
        mongoDb
      )

      const user = await userManagementService.verifyUser(
        userPayload,
        isConsumerUser ? 'CONSUMER' : 'BUSINESS'
      )

      return {
        userId: user.userId,
        ...(krsScore && {
          riskScoreDetails: {
            kycRiskLevel: krsRiskLevel,
            craRiskLevel: craRiskLevel,
            kycRiskScore: krsScore,
            craRiskScore: craScore,
          },
        }),
      } as ConsumerUsersResponse
    }
    return 'Unhandled request'
  }
)
