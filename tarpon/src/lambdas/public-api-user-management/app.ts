import { Credentials } from '@aws-sdk/client-sts'
import {
  APIGatewayEventLambdaAuthorizerContext,
  APIGatewayProxyWithLambdaAuthorizerEvent,
} from 'aws-lambda'
import { BadRequest, NotFound } from 'http-errors'
import { v4 as uuid4 } from 'uuid'
import { logger } from '@/core/logger'
import { UserRepository } from '@/services/users/repositories/user-repository'
import { getDynamoDbClientByEvent } from '@/utils/dynamodb'
import { lambdaApi } from '@/core/middlewares/lambda-api-middlewares'
import { User } from '@/@types/openapi-public/User'
import { Business } from '@/@types/openapi-public/Business'
import { RiskScoringService } from '@/services/risk-scoring'
import { hasFeature, updateLogMetadata } from '@/core/utils/context'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import { UserManagementService } from '@/services/rules-engine/user-rules-engine-service'
import { ConsumerUserMonitoringResult } from '@/@types/openapi-public/ConsumerUserMonitoringResult'
import {
  filterLiveRules,
  sendAsyncRuleTasks,
} from '@/services/rules-engine/utils'
import { Handlers } from '@/@types/openapi-public-custom/DefaultApi'
import { LogicEvaluator } from '@/services/logic-evaluator/engine'
import { BatchImportService } from '@/services/batch-import'
import { RiskScoringV8Service } from '@/services/risk-scoring/risk-scoring-v8-service'
import {
  DefaultApiPostBusinessUserRequest,
  DefaultApiPostConsumerUserRequest,
} from '@/@types/openapi-public/RequestParameters'
import { UserRiskScoreDetails } from '@/@types/openapi-public/UserRiskScoreDetails'
import { getUserRiskScoreDetailsForPNB } from '@/services/rules-engine/pnb-custom-logic'

const MAX_BATCH_IMPORT_COUNT = 200

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
      options?: {
        lockCraRiskLevel?: boolean
        validateUserId?: boolean
        krsOnly?: boolean
      }
    ) => {
      updateLogMetadata({ userId: userPayload.userId })
      logger.info(`Processing User`) // Need to log to show on the logs

      if (options?.validateUserId) {
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
      }
      const logicEvaluator = new LogicEvaluator(tenantId, dynamoDb)
      const isV8RiskScoringEnabled = hasFeature('RISK_SCORING_V8')

      const isDrsUpdatable = options?.lockCraRiskLevel !== true

      const riskScoringService = isV8RiskScoringEnabled
        ? new RiskScoringV8Service(tenantId, logicEvaluator, {
            dynamoDb,
            mongoDb,
          })
        : new RiskScoringService(tenantId, { dynamoDb, mongoDb })

      let riskScoreResult: UserRiskScoreDetails
      if (isV8RiskScoringEnabled) {
        riskScoreResult = await (
          riskScoringService as RiskScoringV8Service
        ).handleUserUpdate(userPayload, userPayload.riskLevel, isDrsUpdatable)
      } else {
        riskScoreResult = await (
          riskScoringService as RiskScoringService
        ).runRiskScoresForUser(userPayload, isDrsUpdatable)
      }

      const { craRiskScore, craRiskLevel, kycRiskScore, kycRiskLevel } =
        riskScoreResult
      if (options?.krsOnly) {
        return {
          userId: userPayload.userId,
          riskScoreDetails: {
            kycRiskScore,
            kycRiskLevel,
          },
          executedRules: [],
          hitRules: [],
        }
      }
      let craRiskLevelToReturn = craRiskLevel
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
      if (hasFeature('PNB') && riskScoreResult) {
        craRiskLevelToReturn = getUserRiskScoreDetailsForPNB(
          user.hitRules ?? [],
          riskScoreResult
        )?.craRiskLevel
      }
      return {
        userId: user.userId,
        ...((kycRiskLevel || craRiskLevel) && {
          riskScoreDetails: {
            ...(kycRiskLevel && { kycRiskLevel, kycRiskScore }),
            ...(craRiskLevelToReturn && {
              craRiskLevel: craRiskLevelToReturn,
              craRiskScore,
            }),
          },
        }),
        ...filterLiveRules({
          executedRules: user.executedRules ?? [],
          hitRules: user.hitRules ?? [],
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
      return {
        ...user,
        ...filterLiveRules({
          executedRules: user.executedRules ?? [],
          hitRules: user.hitRules ?? [],
        }),
      }
    })
    handlers.registerGetBusinessUserUserId(async (_ctx, request) => {
      const user = await userRepository.getBusinessUserWithRiskScores(
        request.userId
      )
      if (!user) {
        throw new NotFound(`User ${request.userId} not found`)
      }
      return {
        ...user,
        ...filterLiveRules({
          executedRules: user.executedRules ?? [],
          hitRules: user.hitRules ?? [],
        }),
      }
    })

    const getCreateUserOptions = (
      request:
        | DefaultApiPostConsumerUserRequest
        | DefaultApiPostBusinessUserRequest
    ) => ({
      lockCraRiskLevel: request.lockCraRiskLevel === 'true',
      validateUserId:
        !request.validateUserId || request.validateUserId === 'true',
      krsOnly: request._krsOnly === 'true',
    })
    handlers.registerPostConsumerUser(async (_ctx, request) => {
      return createUser(request.User, getCreateUserOptions(request))
    })
    handlers.registerPostBusinessUser(async (_ctx, request) => {
      return createUser(request.Business, getCreateUserOptions(request))
    })

    handlers.registerPostBatchConsumerUsers(async (ctx, request) => {
      if (request.UserBatchRequest.data.length > MAX_BATCH_IMPORT_COUNT) {
        throw new BadRequest(`Batch import limit is ${MAX_BATCH_IMPORT_COUNT}.`)
      }

      const batchId = request.UserBatchRequest.batchId || uuid4()
      logger.info(`Processing batch ${batchId}`)
      const batchImportService = new BatchImportService(ctx.tenantId, {
        dynamoDb,
      })
      const { response, validatedUsers } =
        await batchImportService.importConsumerUsers(
          batchId,
          request.UserBatchRequest.data
        )
      await sendAsyncRuleTasks(
        validatedUsers.map((v) => ({
          type: 'USER_BATCH',
          userType: 'CONSUMER',
          user: v,
          tenantId,
        }))
      )
      return response
    })
    handlers.registerPostBatchBusinessUsers(async (ctx, request) => {
      if (request.BusinessBatchRequest.data.length > MAX_BATCH_IMPORT_COUNT) {
        throw new BadRequest(`Batch import limit is ${MAX_BATCH_IMPORT_COUNT}.`)
      }

      const batchId = request.BusinessBatchRequest.batchId || uuid4()
      logger.info(`Processing batch ${batchId}`)
      const batchImportService = new BatchImportService(ctx.tenantId, {
        dynamoDb,
      })
      const { response, validatedUsers } =
        await batchImportService.importBusinessUsers(
          batchId,
          request.BusinessBatchRequest.data
        )
      await sendAsyncRuleTasks(
        validatedUsers.map((v) => ({
          type: 'USER_BATCH',
          userType: 'BUSINESS',
          user: v,
          tenantId,
        }))
      )
      return response
    })
    return await handlers.handle(event)
  }
)
