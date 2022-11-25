import {
  APIGatewayEventLambdaAuthorizerContext,
  APIGatewayProxyWithLambdaAuthorizerEvent,
} from 'aws-lambda'
import { BadRequest } from 'http-errors'
import { StackConstants } from '@cdk/constants'
import { logger } from '@/core/logger'
import { lambdaApi } from '@/core/middlewares/lambda-api-middlewares'
import { updateLogMetadata } from '@/core/utils/context'

import { getDynamoDbClientByEvent } from '@/utils/dynamodb'
import { JWTAuthorizerResult } from '@/@types/jwt'
import { RiskRepository } from '@/services/risk-scoring/repositories/risk-repository'
import { RiskClassificationScore } from '@/@types/openapi-internal/RiskClassificationScore'
import { PostPulseRiskParameters } from '@/@types/openapi-internal/PostPulseRiskParameters'
import { ParameterAttributeRiskValuesParameterEnum } from '@/@types/openapi-internal/ParameterAttributeRiskValues'
import { getMongoDbClient } from '@/utils/mongoDBUtils'

export const riskClassificationHandler = lambdaApi({
  requiredFeatures: ['PULSE'],
})(
  async (
    event: APIGatewayProxyWithLambdaAuthorizerEvent<
      APIGatewayEventLambdaAuthorizerContext<JWTAuthorizerResult>
    >
  ) => {
    const { principalId: tenantId } = event.requestContext.authorizer

    const dynamoDb = getDynamoDbClientByEvent(event)
    const riskRepository = new RiskRepository(tenantId, { dynamoDb })

    if (
      event.httpMethod === 'GET' &&
      event.resource === '/pulse/risk-classification'
    ) {
      try {
        return riskRepository.getRiskClassificationValues()
      } catch (e) {
        logger.error(e)
        return e
      }
    } else if (
      event.httpMethod === 'POST' &&
      event.resource === '/pulse/risk-classification' &&
      event.body
    ) {
      const classificationValues = JSON.parse(
        event.body
      ) as RiskClassificationScore[]
      validateClassificationRequest(classificationValues)
      const result =
        await riskRepository.createOrUpdateRiskClassificationConfig(
          classificationValues
        )
      return result.classificationValues
    }
    throw new BadRequest('Unhandled request')
  }
)

const validateClassificationRequest = (
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
  requiredFeatures: ['PULSE'],
})(
  async (
    event: APIGatewayProxyWithLambdaAuthorizerEvent<
      APIGatewayEventLambdaAuthorizerContext<JWTAuthorizerResult>
    >
  ) => {
    const { principalId: tenantId } = event.requestContext.authorizer
    logger.info('tenantId', tenantId)

    const dynamoDb = getDynamoDbClientByEvent(event)
    const riskRepository = new RiskRepository(tenantId, { dynamoDb })
    if (
      event.httpMethod === 'POST' &&
      event.resource === '/pulse/risk-parameter'
    ) {
      if (!event.body) {
        throw new BadRequest('Empty body')
      }
      let parameterRiskLevels: PostPulseRiskParameters
      try {
        parameterRiskLevels = JSON.parse(event.body)
      } catch (e) {
        throw new BadRequest('Invalid Request')
      }
      return await riskRepository.createOrUpdateParameterRiskItem(
        parameterRiskLevels.parameterAttributeRiskValues
      )
    } else if (
      event.httpMethod === 'GET' &&
      event.resource === '/pulse/risk-parameter'
    ) {
      const parameter = (event.queryStringParameters || {})
        .parameter as ParameterAttributeRiskValuesParameterEnum

      if (parameter == null) {
        throw new BadRequest(`"parameter" is a requred query parameter`)
      }

      return await riskRepository.getParameterRiskItem(parameter)
    }
    throw new BadRequest('Unhandled request')
  }
)

export const manualRiskAssignmentHandler = lambdaApi({
  requiredFeatures: ['PULSE'],
})(
  async (
    event: APIGatewayProxyWithLambdaAuthorizerEvent<
      APIGatewayEventLambdaAuthorizerContext<JWTAuthorizerResult>
    >
  ) => {
    const { principalId: tenantId } = event.requestContext.authorizer
    const { userId } = event.queryStringParameters as any

    // todo: need to assert that user has this feature enabled
    const dynamoDb = getDynamoDbClientByEvent(event)
    const riskRepository = new RiskRepository(tenantId, { dynamoDb })
    if (
      event.httpMethod === 'POST' &&
      event.resource === '/pulse/risk-assignment'
    ) {
      if (!event.body) {
        throw new BadRequest('Empty body')
      }
      let body
      try {
        body = JSON.parse(event.body)
      } catch (e) {
        throw new BadRequest('Invalid Request')
      }
      return riskRepository.createOrUpdateManualDRSRiskItem(
        userId,
        body.riskLevel,
        body.isUpdatable
      )
    } else if (
      event.httpMethod === 'GET' &&
      event.resource === '/pulse/risk-assignment'
    ) {
      return riskRepository.getDRSRiskItem(userId)
    }
    throw new BadRequest('Unhandled request')
  }
)

export const riskLevelAndScoreHandler = lambdaApi({
  requiredFeatures: ['PULSE'],
})(
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

    if (event.httpMethod === 'GET' && event.resource === '/pulse/krs-value') {
      const userId = (event.queryStringParameters || {}).userId as string
      logger.info(`userId: ${userId}`)
      if (userId == null) {
        throw new BadRequest(`"userId" is a requred query parameter`)
      }
      logger.info(`Getting KRS`)

      return riskRepository.getKrsValueFromMongo(userId)
    }
    if (event.httpMethod === 'GET' && event.resource === '/pulse/ars-value') {
      const transactionId = (event.queryStringParameters || {})
        .transactionId as string
      logger.info(`transactionId: ${transactionId}`)
      if (transactionId == null) {
        throw new BadRequest(`"transactionId" is a requred query parameter`)
      }
      logger.info(`Getting ARS`)
      logger.info(
        `ARS: ${await riskRepository.getArsValueFromMongo(transactionId)}`
      )

      return await riskRepository.getArsValueFromMongo(transactionId)
    }
    if (event.httpMethod === 'GET' && event.resource === '/pulse/drs-value') {
      const userId = (event.queryStringParameters || {}).userId as string
      updateLogMetadata({
        userId,
      })
      if (userId == null) {
        throw new BadRequest(`"transactionId" is a requred query parameter`)
      }
      logger.info(`Getting DRS`)
      const score = await riskRepository.getDrsValueFromMongo(userId)
      logger.info(`DRS: ${score}`)
      return score
    }
    throw new BadRequest('Unhandled request')
  }
)
