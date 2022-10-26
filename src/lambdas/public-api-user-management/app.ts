import * as AWS from 'aws-sdk'
import {
  APIGatewayEventLambdaAuthorizerContext,
  APIGatewayProxyWithLambdaAuthorizerEvent,
} from 'aws-lambda'
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb'
import { logger } from '@/core/logger'
import { UserRepository } from '@/services/users/repositories/user-repository'
import { getDynamoDbClientByEvent } from '@/utils/dynamodb'
import { lambdaApi } from '@/core/middlewares/lambda-api-middlewares'
import { RiskRepository } from '@/services/risk-scoring/repositories/risk-repository'
import { User } from '@/@types/openapi-public/User'
import { Business } from '@/@types/openapi-public/Business'
import { updateInitialRiskScores } from '@/services/risk-scoring'
import { hasFeature, updateLogMetadata } from '@/core/utils/context'

const handleRiskLevelParam = (
  tenantId: string,
  dynamoDb: DynamoDBDocumentClient,
  userPayload: User | Business
) => {
  const riskRepository = new RiskRepository(tenantId, { dynamoDb })
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
    const userRepository = new UserRepository(tenantId, {
      dynamoDb: dynamoDb,
    })
    const userId = event.pathParameters?.userId
    const isConsumerUser = event.path.includes('consumer')

    if (event.httpMethod === 'GET' && userId) {
      const user = isConsumerUser
        ? await userRepository.getConsumerUser(userId)
        : await userRepository.getBusinessUser(userId)
      logger.info(user)
      return user
    } else if (event.httpMethod === 'POST' && event.body) {
      const userPayload = JSON.parse(event.body)
      updateLogMetadata({ userId: userPayload.userId })
      logger.info(`Processing User`) // Need to log to show on the logs

      if ((userPayload as User).userId) {
        const user = isConsumerUser
          ? await userRepository.getConsumerUser(userPayload.userId)
          : await userRepository.getBusinessUser(userPayload.userId)
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

      const user = isConsumerUser
        ? await userRepository.saveConsumerUser(userPayload)
        : await userRepository.saveBusinessUser(userPayload)
      if (hasFeature('PULSE')) {
        if (hasFeature('PULSE_KRS_CALCULATION')) {
          await updateInitialRiskScores(tenantId, dynamoDb, user)
        }
        if (userPayload.riskLevel) {
          await handleRiskLevelParam(tenantId, dynamoDb, user)
        }
      }
      return {
        userId: user.userId,
        // TODO: Implement risk score
        userRiskScoreDetails: undefined,
      }
    }
    return 'Unhandled request'
  }
)
