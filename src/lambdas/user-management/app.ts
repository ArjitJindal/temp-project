import * as AWS from 'aws-sdk'
import {
  APIGatewayEventLambdaAuthorizerContext,
  APIGatewayProxyWithLambdaAuthorizerEvent,
} from 'aws-lambda'
import { logger } from '@/core/logger'
import { UserRepository } from '@/services/users/repositories/user-repository'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { lambdaApi } from '@/core/middlewares/lambda-api-middlewares'
import { RiskRepository } from '@/services/rules-engine/repositories/risk-repository'
import { User } from '@/@types/openapi-public/User'
import { Business } from '@/@types/openapi-public/Business'

const handleRiskLevelParam = (
  tenantId: string,
  dynamoDb: AWS.DynamoDB.DocumentClient,
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
    const dynamoDb = getDynamoDbClient(event)
    const userRepository = new UserRepository(tenantId, {
      dynamoDb: dynamoDb,
    })
    const userId = event.pathParameters?.userId

    if (event.path.includes('business')) {
      if (event.httpMethod === 'GET' && userId) {
        const user = await userRepository.getBusinessUser(userId)
        logger.info(user)
        return user
      } else if (event.httpMethod === 'POST' && event.body) {
        const userPayload = JSON.parse(event.body)
        if (userPayload.riskLevel) {
          handleRiskLevelParam(tenantId, dynamoDb, userPayload)
        }
        const user = await userRepository.saveBusinessUser(userPayload)
        const result = {
          userId: user.userId,
          // TODO: Implement risk score
          userRiskScoreDetails: undefined,
        }
        return result
      }
    } else if (event.path.includes('consumer')) {
      if (event.httpMethod === 'GET' && userId) {
        const user = await userRepository.getConsumerUser(userId)
        return user
      } else if (event.httpMethod === 'POST' && event.body) {
        const userPayload = JSON.parse(event.body)
        if (userPayload.riskLevel) {
          handleRiskLevelParam(tenantId, dynamoDb, userPayload)
        }
        const user = await userRepository.saveConsumerUser(userPayload)
        const result = {
          userId: user.userId,
          // TODO: Implement risk score
          userRiskScoreDetails: undefined,
        }
        return result
      }
    }
    return 'Unhandled request'
  }
)
