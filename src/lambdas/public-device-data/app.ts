import {
  APIGatewayEventLambdaAuthorizerContext,
  APIGatewayProxyWithLambdaAuthorizerEvent,
} from 'aws-lambda'
import { updateLogMetadata } from '@/core/utils/context'
import { logger } from '@/core/logger'
import { lambdaApi } from '@/core/middlewares/lambda-api-middlewares'
import { getDynamoDbClientByEvent } from '@/utils/dynamodb'
import { MetricsRepository } from '@/services/rules-engine/repositories/metrics'

export const deviceDataHandler = lambdaApi()(
  async (
    event: APIGatewayProxyWithLambdaAuthorizerEvent<
      APIGatewayEventLambdaAuthorizerContext<AWS.STS.Credentials>
    >
  ) => {
    if (
      event.httpMethod === 'POST' &&
      event.resource === '/device/metric' &&
      event.body
    ) {
      const { principalId: tenantId } = event.requestContext.authorizer

      const metricsPayload = JSON.parse(event.body)
      updateLogMetadata({ userId: metricsPayload.userId })
      logger.info(`Processing User Metrics`)
      const dynamoDb = getDynamoDbClientByEvent(event)
      const metricsRepository = new MetricsRepository(tenantId, {
        dynamoDb: dynamoDb,
      })
      await metricsRepository.saveMetric(metricsPayload)
      return true
    }

    throw new Error('Unhandled request')
  }
)
