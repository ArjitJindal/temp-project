import {
  APIGatewayEventLambdaAuthorizerContext,
  APIGatewayProxyWithLambdaAuthorizerEvent,
} from 'aws-lambda'
import { DeviceDataService } from './services/device-data-service'
import { JWTAuthorizerResult } from '@/@types/jwt'
import { lambdaApi } from '@/core/middlewares/lambda-api-middlewares'
import { getMongoDbClient } from '@/utils/mongoDBUtils'
import { Handlers } from '@/@types/openapi-internal-custom/DefaultApi'

export const deviceDataHandler = lambdaApi()(
  async (
    event: APIGatewayProxyWithLambdaAuthorizerEvent<
      APIGatewayEventLambdaAuthorizerContext<JWTAuthorizerResult>
    >
  ) => {
    const { principalId: tenantId } = event.requestContext.authorizer
    const mongoDb = await getMongoDbClient()
    const deviceDataService = new DeviceDataService(tenantId, { mongoDb })
    const handlers = new Handlers()

    handlers.registerGetDeviceDataTransactions(
      async (ctx, request) =>
        await deviceDataService.getDeviceDataForTransaction(
          request.userId,
          request.transactionId
        )
    )

    handlers.registerGetDeviceDataUsers(
      async (ctx, request) =>
        await deviceDataService.getDeviceDataForUser(request.userId)
    )

    return await handlers.handle(event)
  }
)
