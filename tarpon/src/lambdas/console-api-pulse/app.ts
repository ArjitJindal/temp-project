import {
  APIGatewayEventLambdaAuthorizerContext,
  APIGatewayProxyWithLambdaAuthorizerEvent,
} from 'aws-lambda'
import { Forbidden, BadRequest } from 'http-errors'
import { StackConstants } from '@lib/constants'
import { PulseAuditLogService } from './services/pulse-audit-log'
import { lambdaApi } from '@/core/middlewares/lambda-api-middlewares'
import { getDynamoDbClientByEvent } from '@/utils/dynamodb'
import { JWTAuthorizerResult } from '@/@types/jwt'
import { RiskRepository } from '@/services/risk-scoring/repositories/risk-repository'
import { RiskClassificationScore } from '@/@types/openapi-internal/RiskClassificationScore'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import { Handlers } from '@/@types/openapi-internal-custom/DefaultApi'
import { ParameterAttributeRiskValuesParameterEnum } from '@/@types/openapi-internal/ParameterAttributeRiskValues'
import { hasFeature } from '@/core/utils/context'

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
    const riskRepository = new RiskRepository(tenantId, { dynamoDb })
    const auditLogService = new PulseAuditLogService(tenantId)

    const handlers = new Handlers()

    handlers.registerGetPulseRiskClassification(
      async () => await riskRepository.getRiskClassificationValues()
    )

    handlers.registerPostPulseRiskClassification(async (ctx, request) => {
      validateClassificationRequest(request.RiskClassificationScore)
      const oldClassificationValues =
        await riskRepository.getRiskClassificationValues()
      const result =
        await riskRepository.createOrUpdateRiskClassificationConfig(
          request.RiskClassificationScore
        )
      const newClassificationValues = result.classificationValues
      const oldClassificationValuesAsRiskClassificationScore =
        oldClassificationValues
      await auditLogService.handleAuditLogForRiskClassificationsUpdated(
        oldClassificationValuesAsRiskClassificationScore,
        newClassificationValues
      )
      return newClassificationValues
    })

    return await handlers.handle(event)
  }
)

export const validateClassificationRequest = (
  classificationValues: Array<RiskClassificationScore>
) => {
  if (classificationValues.length != StackConstants.NUMBER_OF_RISK_LEVELS) {
    throw new BadRequest('Invalid Request - Please provide 5 risk levels')
  }
  const unique = new Set()
  const hasDuplicate = classificationValues.some(
    (element) => unique.size === unique.add(element.riskLevel).size
  )
  if (hasDuplicate) {
    throw new BadRequest('Invalid request - duplicate risk levels')
  }
}

export const parameterRiskAssignmentHandler = lambdaApi({
  requiredFeatures: ['RISK_SCORING'],
})(
  async (
    event: APIGatewayProxyWithLambdaAuthorizerEvent<
      APIGatewayEventLambdaAuthorizerContext<JWTAuthorizerResult>
    >
  ) => {
    const { principalId: tenantId } = event.requestContext.authorizer
    const auditLogService = new PulseAuditLogService(tenantId)
    const dynamoDb = getDynamoDbClientByEvent(event)
    const riskRepository = new RiskRepository(tenantId, { dynamoDb })
    const handlers = new Handlers()

    handlers.registerGetPulseRiskParameter(async (ctx, request) => {
      const { parameter, entityType } = request
      if (parameter == null || entityType == null) {
        throw new BadRequest(
          'Invalid request - please provide parameter and entityType'
        )
      }
      return await riskRepository.getParameterRiskItem(
        parameter as ParameterAttributeRiskValuesParameterEnum,
        entityType
      )
    })

    handlers.registerPostPulseRiskParameter(async (ctx, request) => {
      const { parameterAttributeRiskValues } = request.PostPulseRiskParameters
      const oldParameterRiskItemValue =
        await riskRepository.getParameterRiskItem(
          parameterAttributeRiskValues.parameter,
          parameterAttributeRiskValues.riskEntityType
        )
      const newParameterRiskItemValue =
        await riskRepository.createOrUpdateParameterRiskItem(
          parameterAttributeRiskValues
        )
      await auditLogService.handleParameterRiskItemUpdate(
        oldParameterRiskItemValue,
        newParameterRiskItemValue
      )
      return newParameterRiskItemValue
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
    const auditLogService = new PulseAuditLogService(tenantId)
    // todo: need to assert that user has this feature enabled
    const dynamoDb = getDynamoDbClientByEvent(event)
    const client = await getMongoDbClient()
    const riskRepository = new RiskRepository(tenantId, {
      dynamoDb,
      mongoDb: client,
    })
    const handlers = new Handlers()

    handlers.registerGetPulseRiskAssignment(async (ctx, request) =>
      riskRepository.getDRSRiskItem(request.userId)
    )

    handlers.registerPulseManualRiskAssignment(async (ctx, request) => {
      const { riskLevel, isUpdatable } = request.ManualRiskAssignmentPayload
      const { userId } = request
      if (!riskLevel) {
        throw new BadRequest('Invalid request - please provide riskLevel')
      }
      const oldDrsRiskItem = await riskRepository.getDRSRiskItem(userId)
      const newDrsRiskItem =
        await riskRepository.createOrUpdateManualDRSRiskItem(
          userId,
          riskLevel,
          isUpdatable
        )
      await auditLogService.handleDrsUpdate(
        oldDrsRiskItem,
        newDrsRiskItem,
        'MANUAL'
      )
      return newDrsRiskItem
    })

    return await handlers.handle(event)
  }
)

export const riskLevelAndScoreHandler = lambdaApi()(
  async (
    event: APIGatewayProxyWithLambdaAuthorizerEvent<
      APIGatewayEventLambdaAuthorizerContext<JWTAuthorizerResult>
    >
  ) => {
    const { principalId: tenantId } = event.requestContext.authorizer

    const dynamoDb = getDynamoDbClientByEvent(event)
    const client = await getMongoDbClient()

    const riskRepository = new RiskRepository(tenantId, {
      dynamoDb,
      mongoDb: client,
    })

    const handlers = new Handlers()

    handlers.registerGetKrsValue(async (ctx, request) => {
      if (!hasFeature('RISK_SCORING')) {
        throw new Forbidden(
          'Not allowed to access because of missing feature flags: RISK_SCORING'
        )
      }
      return await riskRepository.getKrsValueFromMongo(request.userId)
    })

    handlers.registerGetArsValue(async (ctx, request) => {
      if (!hasFeature('RISK_SCORING')) {
        throw new BadRequest(
          'Not allowed to access because of missing feature flags: RISK_SCORING'
        )
      }
      return await riskRepository.getArsValueFromMongo(request.transactionId)
    })

    handlers.registerGetDrsValue(async (ctx, request) => {
      if (!hasFeature('RISK_SCORING') && !hasFeature('RISK_LEVELS')) {
        throw new BadRequest(
          'Not allowed to access because of missing feature flags: RISK_SCORING, RISK_LEVELS'
        )
      }
      return await riskRepository.getDrsValueFromMongo(request.userId)
    })

    return await handlers.handle(event)
  }
)
