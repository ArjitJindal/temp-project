import {
  APIGatewayEventLambdaAuthorizerContext,
  APIGatewayProxyWithLambdaAuthorizerEvent,
} from 'aws-lambda'
import { BadRequest } from 'http-errors'
import { DeviceDataService } from './services/device-data-service'
import { JWTAuthorizerResult } from '@/@types/jwt'
import { lambdaApi } from '@/core/middlewares/lambda-api-middlewares'
import { getMongoDbClient } from '@/utils/mongoDBUtils'

export const deviceDataHandler = lambdaApi()(
  async (
    event: APIGatewayProxyWithLambdaAuthorizerEvent<
      APIGatewayEventLambdaAuthorizerContext<JWTAuthorizerResult>
    >
  ) => {
    const { principalId: tenantId } = event.requestContext.authorizer
    const mongoDb = await getMongoDbClient()
    const deviceDataService = new DeviceDataService(tenantId, { mongoDb })

    if (event.httpMethod === 'GET') {
      if (event.resource?.endsWith('/transactions')) {
        const { userId, transactionId } = event.queryStringParameters as {
          userId?: string
          transactionId?: string
        }

        if (!userId || !transactionId) {
          throw new BadRequest('User ID and Transaction ID are required')
        }

        return await deviceDataService.getDeviceDataForTransaction(
          userId,
          transactionId
        )
      } else if (event.resource?.endsWith('/users')) {
        const { userId } = event.queryStringParameters as {
          userId?: string
        }

        if (!userId) {
          throw new BadRequest('User ID is required')
        }

        return await deviceDataService.getDeviceDataForUser(userId)
      }
    }

    throw new BadRequest('Invalid request')
  }
)
