import { BadRequest, NotFound } from 'http-errors'
import {
  APIGatewayEventLambdaAuthorizerContext,
  APIGatewayProxyWithLambdaAuthorizerEvent,
} from 'aws-lambda'
import { LiveTestingTaskRepository } from './repositories/live-testing-task-repository'
import { JWTAuthorizerResult } from '@/@types/jwt'
import { lambdaApi } from '@/core/middlewares/lambda-api-middlewares'
import { LiveTestPulseParameters } from '@/@types/openapi-internal/LiveTestPulseParameters'
import { sendBatchJobCommand } from '@/services/batch-job'
import { LiveTestingPulseBatchJob } from '@/@types/batch-job'
import { getMongoDbClient } from '@/utils/mongoDBUtils'
import { DefaultApiGetLiveTestingRequest } from '@/@types/openapi-internal/RequestParameters'
import { getCredentialsFromEvent } from '@/utils/credentials'

export const liveTestingHandler = lambdaApi()(
  async (
    event: APIGatewayProxyWithLambdaAuthorizerEvent<
      APIGatewayEventLambdaAuthorizerContext<JWTAuthorizerResult>
    >
  ) => {
    const { principalId: tenantId } = event.requestContext.authorizer
    const mongoDb = await getMongoDbClient()
    const liveTestingTaskRepository = new LiveTestingTaskRepository(
      tenantId,
      mongoDb
    )

    if (event.resource === '/live-testing') {
      if (event.httpMethod === 'GET') {
        return liveTestingTaskRepository.getLiveTestingTasks(
          event.queryStringParameters as any as DefaultApiGetLiveTestingRequest
        )
      } else if (event.httpMethod === 'POST' && event.body) {
        const liveTestParameters = JSON.parse(
          event.body
        ) as LiveTestPulseParameters
        const taskId = await liveTestingTaskRepository.createLiveTestingTask(
          liveTestParameters
        )
        await sendBatchJobCommand(tenantId, {
          type: 'LIVE_TESTING_PULSE',
          tenantId,
          parameters: {
            taskId,
            ...liveTestParameters,
          },
          awsCredentials: getCredentialsFromEvent(event),
        } as LiveTestingPulseBatchJob)
        return { taskId }
      }
    } else if (
      event.resource === '/live-testing/{taskId}' &&
      event.httpMethod === 'GET' &&
      event.pathParameters?.taskId
    ) {
      const task = await liveTestingTaskRepository.getLiveTestingTask(
        event.pathParameters.taskId
      )
      if (task == null) {
        throw new NotFound(`Live testing task not found`)
      }
      return task
    }

    throw new BadRequest('Unhandled request')
  }
)
