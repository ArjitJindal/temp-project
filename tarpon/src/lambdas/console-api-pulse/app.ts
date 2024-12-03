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
import { RiskEntityType } from '@/@types/openapi-internal/RiskEntityType'
import { RiskFactorParameter } from '@/@types/openapi-internal/RiskFactorParameter'

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
          request.parameter as RiskFactorParameter,
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

    handlers.registerGetPulseRiskParameters(async (_ctx, _request) => {
      return await riskService.getAllRiskParameters()
    })

    handlers.registerGetAllRiskFactors(async (_ctx, request) => {
      return await riskService.getAllRiskFactors(request.entityType)
    })

    handlers.registerGetRiskFactor(async (ctx, request) => {
      return await riskService.getRiskFactor(request.riskFactorId)
    })

    handlers.registerDeleteRiskFactor(async (ctx, request) => {
      return await riskService.deleteRiskFactor(request.riskFactorId)
    })

    handlers.registerPostCreateRiskFactor(async (ctx, request) => {
      return await riskService.createOrUpdateRiskFactor(
        request.RiskFactorsPostRequest
      )
    })

    handlers.registerPutRiskFactors(async (ctx, request) => {
      return await riskService.createOrUpdateRiskFactor(
        request.RiskFactorsUpdateRequest,
        request.riskFactorId
      )
    })

    handlers.registerPostBulkRiskFactors(async (ctx, request) => {
      return await riskService.bulkCreateandReplaceRiskFactors(
        request.RiskFactorsPostRequest
      )
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
        await riskService.getKrsScoreFromDynamo(request.userId)
    )

    handlers.registerGetArsValue(
      async (ctx, request) =>
        await riskService.getArsScoreFromDynamo(request.transactionId)
    )

    handlers.registerGetTrsScores(async (ctx, request) => {
      const result = await riskService.getAverageArsScore(request.userId)
      return result ? { average: result.value } : { average: 0 }
    })

    handlers.registerGetDrsValue(async (ctx, request) => {
      const dynamoResult = await riskService.getDrsScoreFromDynamo(
        request.userId
      )
      if (dynamoResult) {
        return [dynamoResult]
      }
      return null
    })

    return await handlers.handle(event)
  }
)
