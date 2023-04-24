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
import {
  DefaultApiGetSimulationTaskIdResultRequest,
  DefaultApiGetSimulationsRequest,
} from '@/@types/openapi-internal/RequestParameters'
import { getCredentialsFromEvent } from '@/utils/credentials'
import { SimulationPulseParametersRequest } from '@/@types/openapi-internal/SimulationPulseParametersRequest'
import { TenantRepository } from '@/services/tenants/repositories/tenant-repository'
import { getDynamoDbClientByEvent } from '@/utils/dynamodb'
import { SimulationSettings } from '@/@types/openapi-internal/SimulationSettings'
import { SimulationBeaconParametersRequest } from '@/@types/openapi-internal/SimulationBeaconParametersRequest'

export const simulationHandler = lambdaApi({ requiredFeatures: ['SIMULATOR'] })(
  async (
    event: APIGatewayProxyWithLambdaAuthorizerEvent<
      APIGatewayEventLambdaAuthorizerContext<JWTAuthorizerResult>
    >
  ) => {
    const { principalId: tenantId } = event.requestContext.authorizer
    const mongoDb = await getMongoDbClient()
    const dynamoDb = await getDynamoDbClientByEvent(event)
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
        const simulationParameters = JSON.parse(event.body) as
          | SimulationPulseParametersRequest
          | SimulationBeaconParametersRequest

        const tenantRepositry = new TenantRepository(tenantId, {
          dynamoDb,
        })

        const tenantSettings = await tenantRepositry.getTenantSettings()
        const simulationsLimit = tenantSettings.limits?.simulations ?? 0
        const usedSimulations =
          await simulationTaskRepository.getSimulationJobsCount()

        if (
          usedSimulations >= simulationsLimit &&
          process.env.NODE_ENV !== 'test'
        ) {
          throw new BadRequest('Simulations Limit Reached')
        }

        const { taskIds, jobId } =
          await simulationTaskRepository.createSimulationJob(
            simulationParameters
          )

        if (simulationParameters.type === 'BEACON') {
          const defaultRuleInstance = simulationParameters.defaultRuleInstance
          if (defaultRuleInstance.type === 'USER') {
            throw new BadRequest(
              'User rule is not supported for beacon simulation'
            )
          }
        }

        for (let i = 0; i < taskIds.length; i++) {
          if (taskIds[i] && simulationParameters.parameters[i])
            await sendBatchJobCommand(tenantId, {
              type:
                simulationParameters.type === 'PULSE'
                  ? 'SIMULATION_PULSE'
                  : 'SIMULATION_BEACON',
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
      event.resource === '/simulation/jobs/{jobId}' &&
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
      const { items, total } =
        await simulationResultRepository.getSimulationResults({
          taskId: event.pathParameters.taskId,
          ...event.queryStringParameters,
        } as any as DefaultApiGetSimulationTaskIdResultRequest)

      return { items, total }
    } else if (
      event.resource === '/simulation/settings' &&
      event.httpMethod === 'GET'
    ) {
      return {
        count: await simulationTaskRepository.getSimulationJobsCount(),
      } as SimulationSettings
    }

    throw new BadRequest('Unhandled request')
  }
)
