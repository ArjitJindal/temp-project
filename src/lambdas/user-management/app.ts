import * as AWS from 'aws-sdk'
import {
  APIGatewayEventLambdaAuthorizerContext,
  APIGatewayProxyWithLambdaAuthorizerEvent,
} from 'aws-lambda'
import { getDynamoDbClient } from '../../utils/dynamodb'
import { compose } from '../../core/middlewares/compose'
import { httpErrorHandler } from '../../core/middlewares/http-error-handler'
import { jsonSerializer } from '../../core/middlewares/json-serializer'
import { UserRepository } from './repositories/user-repository'

export const userHandler = compose(
  httpErrorHandler(),
  jsonSerializer()
)(
  async (
    event: APIGatewayProxyWithLambdaAuthorizerEvent<
      APIGatewayEventLambdaAuthorizerContext<AWS.STS.Credentials>
    >
  ) => {
    const { principalId: tenantId } = event.requestContext.authorizer
    const dynamoDb = getDynamoDbClient(event)
    const userRepository = new UserRepository(tenantId, dynamoDb)
    const userId = event.pathParameters?.userId

    if (event.path.includes('business')) {
      if (event.httpMethod === 'GET' && userId) {
        const user = await userRepository.getBusinessUser(userId)
        console.log(user)
        return user
      } else if (event.httpMethod === 'POST' && event.body) {
        const user = await userRepository.createBusinessUser(
          JSON.parse(event.body)
        )
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
        const user = await userRepository.createConsumerUser(
          JSON.parse(event.body)
        )
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
