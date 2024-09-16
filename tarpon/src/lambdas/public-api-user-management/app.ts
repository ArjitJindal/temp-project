import { Credentials } from '@aws-sdk/client-sts'
import {
  APIGatewayEventLambdaAuthorizerContext,
  APIGatewayProxyWithLambdaAuthorizerEvent,
} from 'aws-lambda'
import { NotFound } from 'http-errors'
import { v4 as uuid4 } from 'uuid'
import { logger } from '@/core/logger'
import { UserRepository } from '@/services/users/repositories/user-repository'
import { getDynamoDbClientByEvent } from '@/utils/dynamodb'
import { lambdaApi } from '@/core/middlewares/lambda-api-middlewares'
import { User } from '@/@types/openapi-public/User'
import { Business } from '@/@types/openapi-public/Business'
import { RiskScoringService } from '@/services/risk-scoring'
import { updateLogMetadata } from '@/core/utils/context'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import { UserManagementService } from '@/services/rules-engine/user-rules-engine-service'
import { ConsumerUserMonitoringResult } from '@/@types/openapi-public/ConsumerUserMonitoringResult'
import { filterLiveRules } from '@/services/rules-engine/utils'
import { Handlers } from '@/@types/openapi-public-custom/DefaultApi'
import { LogicEvaluator } from '@/services/logic-evaluator/engine'
import { BatchImportService } from '@/services/batch-import'

export const userHandler = lambdaApi()(
  async (
    event: APIGatewayProxyWithLambdaAuthorizerEvent<
      APIGatewayEventLambdaAuthorizerContext<Credentials>
    >
  ) => {
    const { principalId: tenantId } = event.requestContext.authorizer
    const dynamoDb = getDynamoDbClientByEvent(event)
    const mongoDb = await getMongoDbClient()
    const userRepository = new UserRepository(tenantId, {
      dynamoDb: dynamoDb,
      mongoDb,
    })
    const isConsumerUser = event.path.includes('consumer')
    const handlers = new Handlers()

    const validateUser = async (userPayload: User) => {
      if (userPayload.userId) {
        const user = isConsumerUser
          ? await userRepository.getConsumerUserWithRiskScores(
              userPayload.userId
            )
          : await userRepository.getBusinessUserWithRiskScores(
              userPayload.userId
            )

        if (user) {
          return user
        }
      }
    }

    const createUser = async <T extends User | Business>(
      userPayload: T,
      lockCraRiskLevel
    ) => {
      updateLogMetadata({ userId: userPayload.userId })
      logger.info(`Processing User`) // Need to log to show on the logs

      const existingUser = await validateUser(userPayload)
      if (existingUser) {
        return {
          userId: existingUser.userId,
          message:
            'The provided userId already exists. The user attribute updates are not saved. If you want to update the attributes of this user, please use user events instead.',
          riskScoreDetails: existingUser.riskScoreDetails,
          ...filterLiveRules({
            executedRules: existingUser.executedRules,
            hitRules: existingUser.hitRules,
          }),
        }
      }
      const logicEvaluator = new LogicEvaluator(tenantId, dynamoDb)
      const riskScoringService = new RiskScoringService(
        tenantId,
        {
          dynamoDb,
          mongoDb,
        },
        logicEvaluator
      )

      const isDrsUpdatable = lockCraRiskLevel
        ? lockCraRiskLevel !== 'true'
        : true

      const { craRiskScore, kycRiskLevel, kycRiskScore, craRiskLevel } =
        await riskScoringService.runRiskScoresForUser(
          userPayload,
          isDrsUpdatable
        )

      const userManagementService = new UserManagementService(
        tenantId,
        dynamoDb,
        mongoDb,
        logicEvaluator
      )

      const user = await userManagementService.verifyUser(
        userPayload,
        isConsumerUser ? 'CONSUMER' : 'BUSINESS'
      )

      return {
        userId: user.userId,
        ...((kycRiskLevel || craRiskLevel) && {
          riskScoreDetails: {
            ...(kycRiskLevel && { kycRiskLevel, kycRiskScore }),
            ...(craRiskLevel && { craRiskLevel, craRiskScore }),
          },
        }),
        ...filterLiveRules({
          executedRules: user.executedRules,
          hitRules: user.hitRules,
        }),
      } as ConsumerUserMonitoringResult
    }
    handlers.registerGetConsumerUser(async (_ctx, request) => {
      const user = await userRepository.getConsumerUserWithRiskScores(
        request.userId
      )
      if (!user) {
        throw new NotFound(`User ${request.userId} not found`)
      }
      return user
    })
    handlers.registerGetBusinessUserUserId(async (_ctx, request) => {
      const user = await userRepository.getBusinessUserWithRiskScores(
        request.userId
      )
      if (!user) {
        throw new NotFound(`User ${request.userId} not found`)
      }
      return user
    })
    handlers.registerPostConsumerUser(async (_ctx, request) => {
      return createUser(request.User, request.lockCraRiskLevel)
    })
    handlers.registerPostBusinessUser(async (_ctx, request) => {
      return createUser(request.Business, request.lockCraRiskLevel)
    })
    handlers.registerPostBatchConsumerUsers(async (ctx, request) => {
      const batchId = request.UserBatchRequest.batchId || uuid4()
      logger.info(`Processing batch ${batchId}`)
      const batchImportService = new BatchImportService(ctx.tenantId, {
        mongoDb: await getMongoDbClient(),
        dynamoDb,
      })
      const response = await batchImportService.importConsumerUsers(
        batchId,
        request.UserBatchRequest.data
      )
      try {
        // TODO do this in a queue
        await Promise.all(request.UserBatchRequest.data.map(createUser))
      } catch (error) {
        logger.error(`Error verifying transactions: ${error}`)
      }
      return response
    })
    handlers.registerPostBatchBusinessUsers(async (ctx, request) => {
      const batchId = request.BusinessBatchRequest.batchId || uuid4()
      logger.info(`Processing batch ${batchId}`)
      const batchImportService = new BatchImportService(ctx.tenantId, {
        mongoDb: await getMongoDbClient(),
        dynamoDb,
      })
      const response = await batchImportService.importBusinessUsers(
        batchId,
        request.BusinessBatchRequest.data
      )
      return response
    })
    return await handlers.handle(event)
  }
)
