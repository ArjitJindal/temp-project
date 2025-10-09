import {
  APIGatewayEventLambdaAuthorizerContext,
  APIGatewayProxyWithLambdaAuthorizerEvent,
} from 'aws-lambda'
import omit from 'lodash/omit'
import { hasResources } from '@flagright/lib/utils'
import { BadRequest } from 'http-errors'
import { RiskService } from '@/services/risk'
import { lambdaApi } from '@/core/middlewares/lambda-api-middlewares'
import { getDynamoDbClientByEvent } from '@/utils/dynamodb'
import { JWTAuthorizerResult } from '@/@types/jwt'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import { Handlers } from '@/@types/openapi-internal-custom/DefaultApi'
import { hasFeature, userStatements } from '@/core/utils/context'
import { getS3ClientByEvent } from '@/utils/s3'
import { S3Service } from '@/services/aws/s3-service'
import { sendBatchJobCommand } from '@/services/batch-jobs/batch-job'

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
    const mongoDb = await getMongoDbClient()
    const riskService = new RiskService(tenantId, { dynamoDb, mongoDb })

    const handlers = new Handlers()

    handlers.registerGetPulseRiskClassification(async () => {
      const result = await riskService.getRiskClassificationItem()
      return result
    })

    handlers.registerPostPulseRiskClassification(async (ctx, request) => {
      if (hasFeature('APPROVAL_WORKFLOWS')) {
        const response = await riskService.workflowProposeRiskLevelChange(
          request.RiskClassificationRequest.scores,
          request.RiskClassificationRequest.comment
        )
        return response.result.riskClassificationConfig
      }
      const response = await riskService.createOrUpdateRiskClassificationConfig(
        request.RiskClassificationRequest.scores,
        request.RiskClassificationRequest.comment
        // request.RiskClassificationRequest.active
      )
      return response.result
    })

    // Workflow routes for risk classification approval
    handlers.registerPostPulseRiskClassificationWorkflowProposal(
      async (ctx, request) => {
        // Check if approval workflows feature is enabled
        if (!hasFeature('APPROVAL_WORKFLOWS')) {
          throw new BadRequest('Approval workflows feature is not enabled')
        }

        const response = await riskService.workflowProposeRiskLevelChange(
          request.RiskClassificationRequest.scores,
          request.RiskClassificationRequest.comment
        )
        return response.result
      }
    )

    handlers.registerGetPulseRiskClassificationWorkflowProposal(
      async (_ctx, _request) => {
        // Check if approval workflows feature is enabled
        if (!hasFeature('APPROVAL_WORKFLOWS')) {
          throw new BadRequest('Approval workflows feature is not enabled')
        }

        return await riskService.workflowGetPendingRiskLevelChange()
      }
    )

    handlers.registerPostPulseRiskClassificationWorkflowAction(
      async (ctx, request) => {
        // Check if approval workflows feature is enabled
        if (!hasFeature('APPROVAL_WORKFLOWS')) {
          throw new BadRequest('Approval workflows feature is not enabled')
        }

        const response = await riskService.workflowApproveRiskLevelChange(
          request.RiskClassificationApprovalRequest.action
        )
        return response.result
      }
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

    handlers.registerGetAllRiskFactors(async (_ctx, request) => {
      const includeV2 = request.includeV2
      return await riskService.getAllRiskFactors(request.entityType, includeV2)
    })

    handlers.registerGetRiskFactor(async (ctx, request) => {
      return await riskService.getRiskFactor(request.riskFactorId)
    })

    handlers.registerRiskFactorLogic(async (ctx, request) => {
      return await riskService.getRiskFactorLogic(
        request.riskFactorId,
        request.versionId,
        request.riskLevel
      )
    })

    handlers.registerDeleteRiskFactor(async (ctx, request) => {
      if (hasFeature('APPROVAL_WORKFLOWS')) {
        throw new Error(
          'Approval workflows are enabled. Please use the workflow routes instead.'
        )
      }

      return (await riskService.deleteRiskFactor(request.riskFactorId)).result
    })

    // UNUSED ROUTE
    handlers.registerPostCreateRiskFactor(async (ctx, request) => {
      if (hasFeature('APPROVAL_WORKFLOWS')) {
        throw new Error(
          'Approval workflows are enabled. Please use the workflow routes instead.'
        )
      }

      return (
        await riskService.createOrUpdateRiskFactor(
          request.RiskFactorsPostRequest,
          request.RiskFactorsPostRequest.riskFactorId
        )
      ).result
    })

    handlers.registerPutRiskFactors(async (ctx, request) => {
      if (hasFeature('APPROVAL_WORKFLOWS')) {
        throw new Error(
          'Approval workflows are enabled. Please use the workflow routes instead.'
        )
      }

      await riskService.bulkUpdateRiskFactors(
        request.RiskFactorsUpdateRequest.riskFactors,
        request.RiskFactorsUpdateRequest.comment
      )
    })

    handlers.registerGetNewRiskFactorId(async (ctx, request) => {
      return {
        riskFactorId: await riskService.getNewRiskFactorId(request.riskId),
      }
    })

    handlers.registerPostBulkRiskFactors(async (ctx, request) => {
      if (hasFeature('APPROVAL_WORKFLOWS')) {
        throw new Error(
          'Approval workflows are enabled. Please use the workflow routes instead.'
        )
      }

      return await riskService.bulkCreateandReplaceRiskFactors(
        request.RiskFactorsPostRequest
      )
    })

    // Workflow routes for risk factors approval
    handlers.registerPostPulseRiskFactorsWorkflowProposal(
      async (ctx, request) => {
        // Check if approval workflows feature is enabled
        if (!hasFeature('APPROVAL_WORKFLOWS')) {
          throw new Error('Approval workflows feature is not enabled')
        }

        const response = await riskService.workflowProposeRiskFactorChange(
          request.RiskFactorRequest.riskFactor,
          request.RiskFactorRequest.action,
          request.RiskFactorRequest.comment
        )
        return response.result
      }
    )

    handlers.registerPostPulseRiskFactorsWorkflowAction(
      async (ctx, request) => {
        // Check if approval workflows feature is enabled
        if (!hasFeature('APPROVAL_WORKFLOWS')) {
          throw new Error('Approval workflows feature is not enabled')
        }

        const response = await riskService.workflowApproveRiskFactorChange(
          request.RiskFactorsApprovalRequest.riskFactorId,
          request.RiskFactorsApprovalRequest.action as
            | 'accept'
            | 'reject'
            | 'cancel'
        )
        return response.result
      }
    )

    handlers.registerGetPulseRiskFactorsWorkflowProposal(
      async (ctx, request) => {
        // Check if approval workflows feature is enabled
        if (!hasFeature('APPROVAL_WORKFLOWS')) {
          throw new Error('Approval workflows feature is not enabled')
        }

        const riskFactorId = request.riskFactorId
        if (riskFactorId) {
          const proposal =
            await riskService.workflowGetPendingRiskFactorProposal(riskFactorId)
          return proposal ? [proposal] : []
        }
        return await riskService.workflowGetPendingRiskFactorProposals()
      }
    )

    handlers.registerPostRiskFactorsImport(async (ctx, request) => {
      const { file } = request.ImportConsoleDataRequest
      const s3 = getS3ClientByEvent(event)
      const { TMP_BUCKET, DOCUMENT_BUCKET } = process.env as {
        TMP_BUCKET: string
        DOCUMENT_BUCKET: string
      }
      const s3Service = new S3Service(s3, {
        tmpBucketName: TMP_BUCKET,
        documentBucketName: DOCUMENT_BUCKET,
      })
      const fileInfo = await s3Service.copyFlatFilesToPermanentBucket([file])
      await sendBatchJobCommand({
        tenantId,
        type: 'FLAT_FILES_VALIDATION',
        parameters: {
          s3Key: fileInfo[0].s3Key,
          entityId: 'RISK_FACTORS',
          schema: 'RISK_FACTORS_IMPORT',
          format: 'JSONL',
        },
      })
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
      const statements = await userStatements(tenantId)
      const isKycPermissionEnabled = hasResources(statements, [
        'read:::risk-scoring/risk-score-details/*',
      ])
      if (isKycPermissionEnabled) {
        return result
      }
      delete result?.components
      delete result?.factorScoreDetails
      return result
    })

    handlers.registerGetArsValue(async (ctx, request) => {
      const statements = await userStatements(tenantId)
      const isKycPermissionEnabled = hasResources(statements, [
        'read:::risk-scoring/risk-score-details/*',
      ])
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
      const statements = await userStatements(tenantId)
      const isKycPermissionEnabled = hasResources(statements, [
        'read:::risk-scoring/risk-score-details/*',
      ])
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

    handlers.registerGetDrsValues(async (ctx, request) => {
      const statements = await userStatements(tenantId)
      const isDetailsPermissionEnabled = hasResources(statements, [
        'read:::risk-scoring/risk-score-details/*',
      ])
      const result = await riskService.getDrsValuesFromMongo(request)
      if (!isDetailsPermissionEnabled) {
        const updatedData = result.items.map((val) =>
          omit(val, ['components', 'factorScoreDetails'])
        )
        return {
          total: result.total,
          items: updatedData,
        }
      }
      return result
    })

    return await handlers.handle(event)
  }
)
