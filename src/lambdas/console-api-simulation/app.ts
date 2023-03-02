import { BadRequest, NotFound } from 'http-errors'
import {
  APIGatewayEventLambdaAuthorizerContext,
  APIGatewayProxyWithLambdaAuthorizerEvent,
} from 'aws-lambda'
import { SimulationTaskRepository } from './repositories/simulation-task-repository'
import { SimulationResultRepository } from './repositories/simulation-result-repository'
import { JWTAuthorizerResult } from '@/@types/jwt'
import { lambdaApi } from '@/core/middlewares/lambda-api-middlewares'
import { sendBatchJobCommand } from '@/services/batch-job'
import { SimulationPulseBatchJob } from '@/@types/batch-job'
import { getMongoDbClient } from '@/utils/mongoDBUtils'
import { DefaultApiGetSimulationsRequest } from '@/@types/openapi-internal/RequestParameters'
import { getCredentialsFromEvent } from '@/utils/credentials'
import { SimulationPulseParametersRequest } from '@/@types/openapi-internal/SimulationPulseParametersRequest'

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
    const simulationResultRepository = new SimulationResultRepository(
      tenantId,
      mongoDb
    )

    if (event.resource === '/simulation') {
      if (event.httpMethod === 'GET') {
        return simulationTaskRepository.getSimulationJobs(
          event.queryStringParameters as any as DefaultApiGetSimulationsRequest
        )
      } else if (event.httpMethod === 'POST' && event.body) {
        const simulationParameters = JSON.parse(
          event.body
        ) as SimulationPulseParametersRequest

        const { taskIds, jobId } =
          await simulationTaskRepository.createSimulationJob(
            simulationParameters
          )

        for (let i = 0; i < taskIds.length; i++) {
          if (taskIds[i] && simulationParameters.parameters[i])
            await sendBatchJobCommand(tenantId, {
              type: 'SIMULATION_PULSE',
              tenantId,
              parameters: {
                taskId: taskIds[i],
                jobId,
                ...simulationParameters.parameters[i],
              },
              awsCredentials: getCredentialsFromEvent(event),
            } as SimulationPulseBatchJob)
        }

        return { taskIds, jobId }
      }
    } else if (
      event.resource === '/simulation/{jobId}' &&
      event.httpMethod === 'GET' &&
      event.pathParameters?.jobId
    ) {
      const job = await simulationTaskRepository.getSimulationJob(
        event.pathParameters.jobId
      )
      if (job == null) {
        throw new NotFound(`Simulation job not found`)
      }
      return job
    } else if (
      event.resource === '/simulation/tasks/{taskId}/results' &&
      event.httpMethod === 'GET' &&
      event.pathParameters?.taskId
    ) {
      const results = await simulationResultRepository.getSimulationResults(
        event.pathParameters.taskId
      )

      return results
    }

    throw new BadRequest('Unhandled request')
  }
)
