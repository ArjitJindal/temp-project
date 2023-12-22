import { BadRequest, NotFound } from 'http-errors'
import {
  APIGatewayEventLambdaAuthorizerContext,
  APIGatewayProxyWithLambdaAuthorizerEvent,
} from 'aws-lambda'

import { isEmpty } from 'lodash'
import { SimulationTaskRepository } from './repositories/simulation-task-repository'
import { SimulationResultRepository } from './repositories/simulation-result-repository'
import { JWTAuthorizerResult } from '@/@types/jwt'
import { lambdaApi } from '@/core/middlewares/lambda-api-middlewares'
import { sendBatchJobCommand } from '@/services/batch-jobs/batch-job'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import { getCredentialsFromEvent } from '@/utils/credentials'
import { TenantRepository } from '@/services/tenants/repositories/tenant-repository'
import { getDynamoDbClientByEvent } from '@/utils/dynamodb'
import { Handlers } from '@/@types/openapi-internal-custom/DefaultApi'
import { isDemoTenant } from '@/utils/tenant'

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

    const handlers = new Handlers()

    handlers.registerGetSimulations(
      async (ctx, request) =>
        await simulationTaskRepository.getSimulationJobs(request)
    )

    handlers.registerPostSimulation(async (ctx, request) => {
      const simulationParameters =
        request.SimulationPulseParametersRequest___SimulationBeaconParametersRequest
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
        await simulationTaskRepository.createSimulationJob(simulationParameters)
      if (simulationParameters.type === 'BEACON') {
        const defaultRuleInstance = simulationParameters.defaultRuleInstance
        if (defaultRuleInstance.type === 'USER') {
          throw new BadRequest(
            'User rule is not supported for beacon simulation'
          )
        }
      }
      for (let i = 0; i < taskIds.length; i++) {
        if (taskIds[i] && simulationParameters.parameters[i]) {
          if (
            simulationParameters.type === 'BEACON' &&
            !isDemoTenant(tenantId)
          ) {
            await sendBatchJobCommand({
              type: 'SIMULATION_BEACON',
              tenantId,
              parameters: {
                taskId: taskIds[i],
                jobId,
                defaultRuleInstance: simulationParameters.defaultRuleInstance,
                ...simulationParameters.parameters[i],
              },
              awsCredentials: getCredentialsFromEvent(event),
            })
          }

          if (simulationParameters.type === 'PULSE') {
            await sendBatchJobCommand({
              type: 'SIMULATION_PULSE',
              tenantId,
              parameters: {
                taskId: taskIds[i],
                jobId,
                ...simulationParameters.parameters[i],
              },
              awsCredentials: getCredentialsFromEvent(event),
            })
          }
        }
      }
      return { taskIds, jobId }
    })

    handlers.registerGetSimulationTestId(async (ctx, request) => {
      const data = await simulationTaskRepository.getSimulationJob(
        request.jobId
      )
      if (isEmpty(data)) {
        throw new NotFound(`Simulation job ${request.jobId} not found`)
      }

      return data
    })

    handlers.registerGetSimulationTaskIdResult(
      async (ctx, request) =>
        await simulationResultRepository.getSimulationResults(request)
    )

    handlers.registerGetSimulationJobsCount(async () => ({
      runJobsCount: await simulationTaskRepository.getSimulationJobsCount(),
    }))

    return await handlers.handle(event)
  }
)
