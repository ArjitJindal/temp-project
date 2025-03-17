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
import { hasPermission } from '@/utils/auth0-utils'

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

    handlers.registerPostPulseRiskClassification(async (ctx, request) => {
      const response = await riskService.createOrUpdateRiskClassificationConfig(
        request.RiskClassificationScore
      )
      return response.result
    })

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

    handlers.registerPostPulseRiskParameter(async (ctx, request) => {
      const response = await riskService.createOrUpdateRiskParameter(
        request.PostPulseRiskParameters.parameterAttributeRiskValues
      )
      return response.result
    })

    handlers.registerPostPulseRiskParameters(async (ctx, request) => {
      await Promise.all(
        request.PostPulseRiskParametersBulk.parameterAttributeRiskValues.map(
          async (riskParameter) =>
            await riskService.createOrUpdateRiskParameter(riskParameter)
        )
      )
    })

    handlers.registerGetPulseRiskParameters(async (_ctx, _request) => {
      return await riskService.getAllRiskParameters()
    })

    handlers.registerGetAllRiskFactors(async (_ctx, request) => {
      const includeV2 = request.includeV2
      return await riskService.getAllRiskFactors(request.entityType, includeV2)
    })

    handlers.registerGetRiskFactor(async (ctx, request) => {
      return await riskService.getRiskFactor(request.riskFactorId)
    })

    handlers.registerDeleteRiskFactor(async (ctx, request) => {
      return (await riskService.deleteRiskFactor(request.riskFactorId)).result
    })

    handlers.registerPostCreateRiskFactor(async (ctx, request) => {
      return (
        await riskService.createOrUpdateRiskFactor(
          request.RiskFactorsPostRequest,
          request.RiskFactorsPostRequest.riskFactorId
        )
      ).result
    })

    handlers.registerPutRiskFactors(async (ctx, request) => {
      return (
        await riskService.createOrUpdateRiskFactor(
          request.RiskFactorsUpdateRequest,
          request.riskFactorId
        )
      ).result
    })

    handlers.registerGetNewRiskFactorId(async (ctx, request) => {
      return {
        riskFactorId: await riskService.getNewRiskFactorId(request.riskId),
      }
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

    handlers.registerPulseManualRiskAssignment(async (ctx, request) => {
      const response = await riskService.createOrUpdateRiskAssignment(
        request.userId,
        request.ManualRiskAssignmentPayload.riskLevel,
        request.ManualRiskAssignmentPayload.isUpdatable
      )
      return response.result
    })

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

    handlers.registerGetKrsValue(async (ctx, request) => {
      const result = await riskService.getKrsScoreFromDynamo(request.userId)
      const isKycPermissionEnabled = hasPermission(
        'risk-scoring:risk-score-details:read'
      )
      if (isKycPermissionEnabled) {
        return result
      }
      delete result?.components
      delete result?.factorScoreDetails
      return result
    })

    handlers.registerGetArsValue(async (ctx, request) => {
      const isKycPermissionEnabled = hasPermission(
        'risk-scoring:risk-score-details:read'
      )
      const result = await riskService.getArsScoreFromDynamo(
        request.transactionId
      )
      if (isKycPermissionEnabled) {
        return result
      }
      delete result?.components
      delete result?.factorScoreDetails
      return result
    })

    handlers.registerGetTrsScores(async (ctx, request) => {
      const result = await riskService.getAverageArsScore(request.userId)
      return result ? { average: result.value } : { average: 0 }
    })

    handlers.registerGetDrsValue(async (ctx, request) => {
      const dynamoResult = await riskService.getDrsScoreFromDynamo(
        request.userId
      )
      const isKycPermissionEnabled = hasPermission(
        'risk-scoring:risk-score-details:read'
      )
      if (isKycPermissionEnabled && dynamoResult) {
        return [dynamoResult]
      }
      delete dynamoResult?.components
      delete dynamoResult?.factorScoreDetails

      if (dynamoResult) {
        return [dynamoResult]
      }
      return null
    })

    return await handlers.handle(event)
  }
)
