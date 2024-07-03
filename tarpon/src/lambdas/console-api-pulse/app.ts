import {
  APIGatewayEventLambdaAuthorizerContext,
  APIGatewayProxyWithLambdaAuthorizerEvent,
} from 'aws-lambda'
import { RiskService } from '@/services/risk'
import { lambdaApi } from '@/core/middlewares/lambda-api-middlewares'
import { getDynamoDbClientByEvent } from '@/utils/dynamodb'
import { JWTAuthorizerResult } from '@/@types/jwt'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import { Handlers } from '@/@types/openapi-internal-custom/DefaultApi'
import { ParameterAttributeRiskValuesParameterEnum } from '@/@types/openapi-internal/ParameterAttributeRiskValues'
import { RiskEntityType } from '@/@types/openapi-internal/RiskEntityType'

export const riskClassificationHandler = lambdaApi({
  requiredFeatures: ['RISK_SCORING'],
})(
  async (
    event: APIGatewayProxyWithLambdaAuthorizerEvent<
      APIGatewayEventLambdaAuthorizerContext<JWTAuthorizerResult>
    >
  ) => {
    const { principalId: tenantId } = event.requestContext.authorizer

    const dynamoDb = getDynamoDbClientByEvent(event)
    const riskService = new RiskService(tenantId, { dynamoDb })

    const handlers = new Handlers()

    handlers.registerGetPulseRiskClassification(
      async () => await riskService.getRiskClassificationValues()
    )

    handlers.registerPostPulseRiskClassification(
      async (ctx, request) =>
        await riskService.createOrUpdateRiskClassificationConfig(
          request.RiskClassificationScore
        )
    )

    return await handlers.handle(event)
  }
)

export const parameterRiskAssignmentHandler = lambdaApi({
  requiredFeatures: ['RISK_SCORING'],
})(
  async (
    event: APIGatewayProxyWithLambdaAuthorizerEvent<
      APIGatewayEventLambdaAuthorizerContext<JWTAuthorizerResult>
    >
  ) => {
    const { principalId: tenantId } = event.requestContext.authorizer
    const dynamoDb = getDynamoDbClientByEvent(event)
    const mongoDb = await getMongoDbClient()
    const riskService = new RiskService(tenantId, { dynamoDb, mongoDb })
    const handlers = new Handlers()

    handlers.registerGetPulseRiskParameter(
      async (ctx, request) =>
        await riskService.getRiskParameter(
          request.parameter as ParameterAttributeRiskValuesParameterEnum,
          request.entityType as RiskEntityType
        )
    )

    handlers.registerPostPulseRiskParameter(
      async (ctx, request) =>
        await riskService.createOrUpdateRiskParameter(
          request.PostPulseRiskParameters.parameterAttributeRiskValues
        )
    )

    handlers.registerPostPulseRiskParameters(async (ctx, request) => {
      await Promise.all(
        request.PostPulseRiskParametersBulk.parameterAttributeRiskValues.map(
          (riskParameter) =>
            riskService.createOrUpdateRiskParameter(riskParameter)
        )
      )
    })

    handlers.registerPostPulseRiskParametersV8(async (ctx, request) => {
      return await riskService.createOrUpdateRiskParameterV8(
        request.ParameterAttributeValuesV8Request
      )
    })

    handlers.registerGetPulseRiskParametersV8(async (ctx, request) => {
      return await riskService.getParameterRiskItemsV8(request.entityType)
    })

    handlers.registerPutPulseRiskParametersV8(async (ctx, request) => {
      return await riskService.createOrUpdateRiskParameterV8(
        request.ParameterAttributeValuesV8Request,
        request.riskParameterId
      )
    })

    handlers.registerDeletePulseRiskParametersV8(async (ctx, request) => {
      return await riskService.deleteRiskParameterV8(request.riskParameterId)
    })

    handlers.registerGetPulseRiskParameterIdRiskParametersV8(
      async (ctx, request) => {
        return await riskService.getRiskParameterV8(request.riskParameterId)
      }
    )

    handlers.registerGetPulseRiskParameters(async (_ctx, _request) => {
      return await riskService.getAllRiskParameters()
    })

    return await handlers.handle(event)
  }
)

export const manualRiskAssignmentHandler = lambdaApi({
  requiredFeatures: ['RISK_LEVELS'],
})(
  async (
    event: APIGatewayProxyWithLambdaAuthorizerEvent<
      APIGatewayEventLambdaAuthorizerContext<JWTAuthorizerResult>
    >
  ) => {
    const { principalId: tenantId } = event.requestContext.authorizer
    // todo: need to assert that user has this feature enabled
    const dynamoDb = getDynamoDbClientByEvent(event)
    const client = await getMongoDbClient()
    const riskService = new RiskService(tenantId, {
      dynamoDb,
      mongoDb: client,
    })
    const handlers = new Handlers()

    handlers.registerGetPulseRiskAssignment(
      async (ctx, request) =>
        await riskService.getRiskAssignment(request.userId)
    )

    handlers.registerPulseManualRiskAssignment(
      async (ctx, request) =>
        await riskService.createOrUpdateRiskAssignment(
          request.userId,
          request.ManualRiskAssignmentPayload.riskLevel,
          request.ManualRiskAssignmentPayload.isUpdatable
        )
    )

    return await handlers.handle(event)
  }
)

export const riskLevelAndScoreHandler = lambdaApi({
  requiredFeatures: ['RISK_SCORING', 'RISK_LEVELS'],
})(
  async (
    event: APIGatewayProxyWithLambdaAuthorizerEvent<
      APIGatewayEventLambdaAuthorizerContext<JWTAuthorizerResult>
    >
  ) => {
    const { principalId: tenantId } = event.requestContext.authorizer

    const dynamoDb = getDynamoDbClientByEvent(event)
    const mongoDb = await getMongoDbClient()
    const riskService = new RiskService(tenantId, { dynamoDb, mongoDb })
    const handlers = new Handlers()

    handlers.registerGetKrsValue(
      async (ctx, request) =>
        await riskService.getKrsValueFromMongo(request.userId)
    )

    handlers.registerGetArsValue(
      async (ctx, request) =>
        await riskService.getArsValueFromMongo(request.transactionId)
    )

    handlers.registerGetTrsScores(
      async (ctx, request) =>
        await riskService.getAverageArsScoreForUser(request.userId)
    )

    handlers.registerGetDrsValue(
      async (ctx, request) =>
        await riskService.getDrsValueFromMongo(request.userId)
    )

    return await handlers.handle(event)
  }
)
