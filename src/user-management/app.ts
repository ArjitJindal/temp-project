import * as AWS from 'aws-sdk'
import {
  APIGatewayEventLambdaAuthorizerContext,
  APIGatewayProxyWithLambdaAuthorizerHandler,
} from 'aws-lambda'
import { UserRepository } from './repositories/user-repository'
import { getDynamoDbClient } from '../utils/dynamodb'

export const userHandler: APIGatewayProxyWithLambdaAuthorizerHandler<
  APIGatewayEventLambdaAuthorizerContext<AWS.STS.Credentials>
> = async (event) => {
  const { principalId: tenantId } = event.requestContext.authorizer
  const dynamoDb = getDynamoDbClient(event)
  const userRepository = new UserRepository(tenantId, dynamoDb)
  const userId = event.pathParameters?.userId

  if (event.path.includes('business')) {
    if (event.httpMethod === 'GET' && userId) {
      const user = await userRepository.getBusinessUser(userId)
      console.log(user)
      return {
        statusCode: 200,
        body: JSON.stringify(user),
      }
    } else if (event.httpMethod === 'POST' && event.body) {
      const user = await userRepository.createBusinessUser(
        JSON.parse(event.body)
      )
      const result = {
        userId: user.userId,
        // TODO: Implement risk score
        userRiskScoreDetails: undefined,
      }
      return {
        statusCode: 201,
        body: JSON.stringify(result),
      }
    }
  } else if (event.path.includes('consumer')) {
    if (event.httpMethod === 'GET' && userId) {
      const user = await userRepository.getConsumerUser(userId)
      return {
        statusCode: 200,
        body: JSON.stringify(user),
      }
    } else if (event.httpMethod === 'POST' && event.body) {
      const user = await userRepository.createConsumerUser(
        JSON.parse(event.body)
      )
      const result = {
        userId: user.userId,
        // TODO: Implement risk score
        userRiskScoreDetails: undefined,
      }
      return {
        statusCode: 201,
        body: JSON.stringify(result),
      }
    }
  }
  return {
    statusCode: 500,
    body: 'Unhandled request',
  }
}
