import * as AWS from 'aws-sdk'
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

const handleRiskLevelParam = (
  tenantId: string,
  dynamoDb: DynamoDBDocumentClient,
  userPayload: User | Business,
  mongoDb: MongoClient
) => {
  const riskRepository = new RiskRepository(tenantId, { dynamoDb, mongoDb })
  riskRepository.createOrUpdateManualDRSRiskItem(
    userPayload.userId,
    userPayload.riskLevel!
  )
  delete userPayload.riskLevel
}

export const userHandler = lambdaApi()(
  async (
    event: APIGatewayProxyWithLambdaAuthorizerEvent<
      APIGatewayEventLambdaAuthorizerContext<AWS.STS.Credentials>
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
        ? await userRepository.getConsumerUser(userId)
        : await userRepository.getBusinessUser(userId)
      if (!user) {
        throw new NotFound(`User ${userId} not found`)
      }
      return user
    } else if (event.httpMethod === 'POST' && event.body) {
      const userPayload = JSON.parse(event.body)
      updateLogMetadata({ userId: userPayload.userId })
      logger.info(`Processing User`) // Need to log to show on the logs

      if (userPayload.userId) {
        const user = isConsumerUser
          ? await userRepository.getConsumerUser(userPayload.userId as string)
          : await userRepository.getBusinessUser(userPayload.userId as string)
        if (user) {
          return {
            userId: user.userId,
            message:
              'The provided userId already exists. The user attribute updates are not saved. If you want to update the attributes of this user, please use user events instead.',
            // TODO: Implement risk score
            userRiskScoreDetails: undefined,
          }
        }
      }

      if (hasFeature('PULSE')) {
        const riskScoringService = new RiskScoringService(tenantId, {
          dynamoDb,
          mongoDb,
        })
        await riskScoringService.updateInitialRiskScores(
          userPayload as User | Business
        )

        if (userPayload.riskLevel) {
          await handleRiskLevelParam(
            tenantId,
            dynamoDb,
            userPayload as User | Business,
            mongoDb
          )
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
        // TODO: Implement risk score
        userRiskScoreDetails: undefined,
      }
    }
    return 'Unhandled request'
  }
)
