import { BadRequest, NotFound } from 'http-errors'
import {
  APIGatewayEventLambdaAuthorizerContext,
  APIGatewayProxyWithLambdaAuthorizerEvent,
} from 'aws-lambda'
import { SimulationTaskRepository } from './repositories/simulation-task-repository'
import { JWTAuthorizerResult } from '@/@types/jwt'
import { lambdaApi } from '@/core/middlewares/lambda-api-middlewares'
import { SimulationPulseParameters } from '@/@types/openapi-internal/SimulationPulseParameters'
import { sendBatchJobCommand } from '@/services/batch-job'
import { SimulationPulseBatchJob } from '@/@types/batch-job'
import { getMongoDbClient } from '@/utils/mongoDBUtils'
import { DefaultApiGetSimulationsRequest } from '@/@types/openapi-internal/RequestParameters'
import { getCredentialsFromEvent } from '@/utils/credentials'

export const simulationHandler = lambdaApi()(
  async (
    event: APIGatewayProxyWithLambdaAuthorizerEvent<
      APIGatewayEventLambdaAuthorizerContext<JWTAuthorizerResult>
    >
  ) => {
    const { principalId: tenantId } = event.requestContext.authorizer
    const mongoDb = await getMongoDbClient()
    const simulationTaskRepository = new SimulationTaskRepository(
      tenantId,
      mongoDb
    )

    if (event.resource === '/simulation') {
      if (event.httpMethod === 'GET') {
        return simulationTaskRepository.getSimulationTasks(
          event.queryStringParameters as any as DefaultApiGetSimulationsRequest
        )
      } else if (event.httpMethod === 'POST' && event.body) {
        const simulationParameters = JSON.parse(
          event.body
        ) as SimulationPulseParameters
        const taskId = await simulationTaskRepository.createSimulationTask(
          simulationParameters
        )
        await sendBatchJobCommand(tenantId, {
          type: 'SIMULATION_PULSE',
          tenantId,
          parameters: {
            taskId,
            ...simulationParameters,
          },
          awsCredentials: getCredentialsFromEvent(event),
        } as SimulationPulseBatchJob)
        return { taskId }
      }
    } else if (
      event.resource === '/simulation/{taskId}' &&
      event.httpMethod === 'GET' &&
      event.pathParameters?.taskId
    ) {
      const task = await simulationTaskRepository.getSimulationTask(
        event.pathParameters.taskId
      )
      if (task == null) {
        throw new NotFound(`Simulation task not found`)
      }
      return task
    }

    throw new BadRequest('Unhandled request')
  }
)
