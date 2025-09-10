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
import { updateLogMetadata } from '@/core/utils/context'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import { UserManagementService } from '@/services/rules-engine/user-rules-engine-service'
import {
  filterLiveRules,
  sendAsyncRuleTasks,
} from '@/services/rules-engine/utils'
import { Handlers } from '@/@types/openapi-public-custom/DefaultApi'
import { LogicEvaluator } from '@/services/logic-evaluator/engine'
import { BatchImportService } from '@/services/batch-import'
import {
  DefaultApiPostBusinessUserRequest,
  DefaultApiPostConsumerUserRequest,
} from '@/@types/openapi-public/RequestParameters'

export const MAX_BATCH_IMPORT_COUNT = 200

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
        lockKycRiskLevel?: boolean
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
      const userManagementService = new UserManagementService(
        tenantId,
        dynamoDb,
        mongoDb,
        logicEvaluator
      )
      return await userManagementService.createAndVerifyUser(
        userPayload,
        isConsumerUser,
        options
      )
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
      lockCraRiskLevel: request.lockCraRiskLevel
        ? request.lockCraRiskLevel === 'true'
        : undefined,
      validateUserId:
        !request.validateUserId || request.validateUserId === 'true',
      krsOnly: request._krsOnly === 'true',
      lockKycRiskLevel: request.lockKycRiskLevel
        ? request.lockKycRiskLevel === 'true'
        : undefined,
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
        mongoDb: await getMongoDbClient(),
      })
      const { response, validatedUsers } =
        await batchImportService.importConsumerUsers(
          batchId,
          request.UserBatchRequest.data
        )
      const isDrsUpdatable = request.lockCraRiskLevel
        ? request.lockCraRiskLevel !== 'true'
        : undefined
      const lockKrs = request.lockKycRiskLevel
        ? request.lockKycRiskLevel === 'true'
        : undefined

      await sendAsyncRuleTasks(
        validatedUsers.map((v) => ({
          type: 'USER_BATCH',
          userType: 'CONSUMER',
          user: v,
          tenantId,
          batchId,
          parameters: {
            lockCraRiskLevel: isDrsUpdatable,
            lockKycRiskLevel: lockKrs,
          },
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
        mongoDb: await getMongoDbClient(),
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
          batchId,
        }))
      )
      return response
    })
    handlers.registerGetBatchBusinessUsers(async (ctx, request) => {
      const { batchId, page, pageSize } = request
      const batchImportService = new BatchImportService(ctx.tenantId, {
        dynamoDb,
        mongoDb: await getMongoDbClient(),
      })
      return await batchImportService.getBatchBusinessUsers(batchId, {
        page,
        pageSize,
      })
    })
    handlers.registerGetBatchConsumerUsers(async (ctx, request) => {
      const { batchId, page, pageSize } = request
      const batchImportService = new BatchImportService(ctx.tenantId, {
        dynamoDb,
        mongoDb: await getMongoDbClient(),
      })
      return await batchImportService.getBatchConsumerUsers(batchId, {
        page,
        pageSize,
      })
    })
    return await handlers.handle(event)
  }
)
