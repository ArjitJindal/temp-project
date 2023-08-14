import {
  APIGatewayEventLambdaAuthorizerContext,
  APIGatewayProxyWithLambdaAuthorizerEvent,
} from 'aws-lambda'
import { BadRequest } from 'http-errors'
import { Credentials } from '@aws-sdk/client-sts'
import { updateLogMetadata } from '@/core/utils/context'
import { logger } from '@/core/logger'
import { lambdaApi } from '@/core/middlewares/lambda-api-middlewares'
import { getDynamoDbClientByEvent } from '@/utils/dynamodb'
import { MetricsRepository } from '@/services/rules-engine/repositories/metrics'
import { getMongoDbClient } from '@/utils/mongoDBUtils'
import { DeviceMetric } from '@/@types/openapi-internal/DeviceMetric'
import { DeviceDataService } from '@/services/device-data'

export const deviceDataHandler = lambdaApi()(
  async (
    event: APIGatewayProxyWithLambdaAuthorizerEvent<
      APIGatewayEventLambdaAuthorizerContext<Credentials>
    >
  ) => {
    const { principalId: tenantId } = event.requestContext.authorizer
    const dynamoDb = getDynamoDbClientByEvent(event)
    const mongoDb = await getMongoDbClient()
    const metricsRepository = new MetricsRepository(tenantId, {
      dynamoDb,
      mongoDb,
    })
    if (
      event.httpMethod === 'POST' &&
      event.resource === '/metrics' &&
      event.body
    ) {
      const deviceDataService = new DeviceDataService(tenantId, {
        mongoDb,
        dynamoDb,
      })

      const metricsPayload = JSON.parse(event.body) as DeviceMetric
      updateLogMetadata({ userId: metricsPayload.userId })
      logger.info(`Processing User Metrics`)
      await deviceDataService.saveDeviceData(metricsPayload)
      return true
    }

    if (event.httpMethod === 'GET' && event.resource === '/metrics') {
      const { deviceFingerprint, userId } = event.queryStringParameters as {
        deviceFingerprint?: string
        userId?: string
      }
      if (!deviceFingerprint && !userId) {
        throw new BadRequest(
          'One of deviceFingerprint or userId must be specified'
        )
      }
      const metrics = await metricsRepository.getMongoUserMetrics({
        deviceFingerprint,
        userId,
      })
      return {
        data: metrics,
      }
    }

    throw new Error('Unhandled request')
  }
)
