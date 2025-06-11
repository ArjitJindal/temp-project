import { BadRequest, NotFound } from 'http-errors'
import {
  APIGatewayEventLambdaAuthorizerContext,
  APIGatewayProxyWithLambdaAuthorizerEvent,
} from 'aws-lambda'
import { isEmpty } from 'lodash'
import { JWTAuthorizerResult } from '@/@types/jwt'
import { lambdaApi } from '@/core/middlewares/lambda-api-middlewares'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import { Handlers } from '@/@types/openapi-internal-custom/DefaultApi'
import { SimulationService } from '@/services/simulation'

export const simulationHandler = lambdaApi({ requiredFeatures: ['SIMULATOR'] })(
  async (
    event: APIGatewayProxyWithLambdaAuthorizerEvent<
      APIGatewayEventLambdaAuthorizerContext<JWTAuthorizerResult>
    >
  ) => {
    const { principalId: tenantId } = event.requestContext.authorizer
    const mongoDb = await getMongoDbClient()
    const simulationService = new SimulationService(tenantId, { mongoDb })
    const handlers = new Handlers()

    handlers.registerGetSimulations(
      async (ctx, request) => await simulationService.getSimulationJobs(request)
    )

    handlers.registerPostSimulation(async (ctx, request) => {
      const parameters =
        request.SimulationPostRequest.beaconParameters ||
        request.SimulationPostRequest.riskLevelsParameters ||
        request.SimulationPostRequest.riskFactorsV8Parameters

      if (!parameters) {
        throw new BadRequest('Invalid simulation parameters')
      }
      return await simulationService.createSimulation(parameters)
    })

    handlers.registerGetSimulationTestId(async (ctx, request) => {
      const data = await simulationService.getSimulationJob(request.jobId)

      if (isEmpty(data) || data === null) {
        throw new NotFound(`Simulation job ${request.jobId} not found`)
      }

      return data
    })

    handlers.registerGetSimulationTaskIdResult(
      async (ctx, request) =>
        await simulationService.getSimulationResults(request)
    )

    handlers.registerGetSimulationJobsCount(
      async () => await simulationService.getSimulationJobsCount()
    )

    return await handlers.handle(event)
  }
)
