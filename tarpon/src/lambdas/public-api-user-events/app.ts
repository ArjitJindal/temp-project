import {
  APIGatewayEventLambdaAuthorizerContext,
  APIGatewayProxyWithLambdaAuthorizerEvent,
} from 'aws-lambda'
import { NotFound, BadRequest } from 'http-errors'
import { Credentials } from '@aws-sdk/client-sts'
import { v4 as uuid4, v4 as uuidv4 } from 'uuid'
import { getDynamoDbClientByEvent } from '@/utils/dynamodb'
import { publicLambdaApi } from '@/core/middlewares/public-lambda-api-middleware'
import { ConsumerUserEvent } from '@/@types/openapi-public/ConsumerUserEvent'
import { hasFeature, updateLogMetadata } from '@/core/utils/context'
import { logger } from '@/core/logger'
import { UserManagementService } from '@/services/rules-engine/user-rules-engine-service'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import { pickKnownEntityFields } from '@/utils/object'
import { UserOptional } from '@/@types/openapi-public/UserOptional'
import { BusinessOptional } from '@/@types/openapi-public/BusinessOptional'
import { UserEventRepository } from '@/services/rules-engine/repositories/user-event-repository'
import {
  filterLiveRules,
  sendAsyncRuleTasks,
} from '@/services/rules-engine/utils'
import { Handlers } from '@/@types/openapi-public-custom/DefaultApi'
import { LogicEvaluator } from '@/services/logic-evaluator/engine'
import { BatchImportService } from '@/services/batch-import'
import { UserWithRulesResult } from '@/@types/openapi-internal/UserWithRulesResult'
import { MAX_BATCH_IMPORT_COUNT } from '@/utils/transaction'
import { batchCreateUserOptions } from '@/utils/user'
import { assertValidTimestampTags } from '@/utils/tags'
import { getSharedOpensearchClient } from '@/utils/opensearch-utils'

export const userEventsHandler = publicLambdaApi()(
  async (
    event: APIGatewayProxyWithLambdaAuthorizerEvent<
      APIGatewayEventLambdaAuthorizerContext<Credentials>
    >
  ) => {
    const handlers = new Handlers()
    const { principalId: tenantId } = event.requestContext.authorizer
    const dynamoDb = getDynamoDbClientByEvent(event)
    const mongoDb = await getMongoDbClient()
    const opensearchClient = hasFeature('OPEN_SEARCH')
      ? await getSharedOpensearchClient()
      : undefined
    const createUserEvent = async (
      userEvent: ConsumerUserEvent,
      allowUserTypeConversion?: string,
      lockCraRiskLevel?: string,
      lockKycRiskLevel?: string
    ) => {
      userEvent.updatedConsumerUserAttributes =
        userEvent.updatedConsumerUserAttributes &&
        pickKnownEntityFields(
          userEvent.updatedConsumerUserAttributes,
          UserOptional
        )
      updateLogMetadata({
        userId: userEvent.userId,
        eventId: userEvent.eventId,
      })
      logger.info(`Processing Consumer User Event`) // Need to log to show on the logs
      const logicEvaluator = new LogicEvaluator(tenantId, dynamoDb)
      const userManagementService = new UserManagementService(
        tenantId,
        dynamoDb,
        mongoDb,
        logicEvaluator,
        opensearchClient
      )

      const { updatedConsumerUserAttributes } = userEvent
      if (updatedConsumerUserAttributes?.linkedEntities) {
        await userManagementService.validateLinkedEntitiesAndEmitEvent(
          updatedConsumerUserAttributes?.linkedEntities,
          userEvent.userId
        )
      }
      const isDrsUpdatable = lockCraRiskLevel
        ? lockCraRiskLevel !== 'true'
        : undefined
      const lockKrs = lockKycRiskLevel ? lockKycRiskLevel === 'true' : undefined
      const result: UserWithRulesResult =
        await userManagementService.verifyConsumerUserEvent(
          userEvent,
          allowUserTypeConversion === 'true',
          isDrsUpdatable,
          lockKrs
        )

      return {
        ...result,
        ...filterLiveRules(result),
      }
    }

    handlers.registerPostUserEvent(
      async (
        _ctx,
        {
          ConsumerUserEvent: userEvent,
          allowUserTypeConversion,
          lockCraRiskLevel,
          lockKycRiskLevel,
        }
      ) => {
        assertValidTimestampTags(userEvent.updatedConsumerUserAttributes?.tags)
        return createUserEvent(
          userEvent,
          allowUserTypeConversion,
          lockCraRiskLevel,
          lockKycRiskLevel
        )
      }
    )
    handlers.registerPostBatchConsumerUserEvents(async (ctx, request) => {
      if (
        request.ConsumerUserEventBatchRequest.data.length >
        MAX_BATCH_IMPORT_COUNT
      ) {
        throw new BadRequest(`Batch import limit is ${MAX_BATCH_IMPORT_COUNT}.`)
      }
      const batchId = request.ConsumerUserEventBatchRequest.batchId || uuid4()
      logger.info(`Processing batch ${batchId}`)
      const batchImportService = new BatchImportService(ctx.tenantId, {
        dynamoDb,
        mongoDb,
      })
      for (const userEvent of request.ConsumerUserEventBatchRequest.data) {
        assertValidTimestampTags(userEvent.updatedConsumerUserAttributes?.tags)
      }
      const { response, validatedUserEvents } =
        await batchImportService.importConsumerUserEvents(
          batchId,
          request.ConsumerUserEventBatchRequest.data
        )
      await sendAsyncRuleTasks(
        validatedUserEvents.map((v) => ({
          type: 'USER_EVENT_BATCH',
          userType: 'CONSUMER',
          userEvent: { ...v, eventId: v.eventId ?? uuidv4() },
          tenantId,
          batchId,
          parameters: batchCreateUserOptions(request),
        }))
      )
      return response
    })
    handlers.registerPostBatchBusinessUserEvents(async (ctx, request) => {
      if (
        request.BusinessUserEventBatchRequest.data.length >
        MAX_BATCH_IMPORT_COUNT
      ) {
        throw new BadRequest(`Batch import limit is ${MAX_BATCH_IMPORT_COUNT}.`)
      }
      for (const userEvent of request.BusinessUserEventBatchRequest.data) {
        assertValidTimestampTags(userEvent.updatedBusinessUserAttributes?.tags)
      }
      const batchId = request.BusinessUserEventBatchRequest.batchId || uuid4()
      logger.info(`Processing batch ${batchId}`)
      const batchImportService = new BatchImportService(ctx.tenantId, {
        dynamoDb,
        mongoDb,
      })
      const { response, validatedUserEvents } =
        await batchImportService.importBusinessUserEvents(
          batchId,
          request.BusinessUserEventBatchRequest.data
        )
      await sendAsyncRuleTasks(
        validatedUserEvents.map((v) => ({
          type: 'USER_EVENT_BATCH',
          userType: 'BUSINESS',
          userEvent: { ...v, eventId: v.eventId ?? uuidv4() },
          tenantId,
          batchId,
          parameters: batchCreateUserOptions(request),
        }))
      )
      return response
    })
    handlers.registerPostBusinessUserEvent(
      async (
        _ctx,
        {
          BusinessUserEvent: userEvent,
          allowUserTypeConversion,
          lockCraRiskLevel,
          lockKycRiskLevel,
        }
      ) => {
        userEvent.updatedBusinessUserAttributes =
          userEvent.updatedBusinessUserAttributes &&
          pickKnownEntityFields(
            userEvent.updatedBusinessUserAttributes,
            BusinessOptional
          )
        updateLogMetadata({
          businessUserId: userEvent.userId,
          eventId: userEvent.eventId,
        })
        logger.info(`Processing Business User Event`) // Need to log to show on the logs
        const logicEvaluator = new LogicEvaluator(tenantId, dynamoDb)
        const userManagementService = new UserManagementService(
          tenantId,
          dynamoDb,
          mongoDb,
          logicEvaluator,
          opensearchClient
        )
        const { updatedBusinessUserAttributes } = userEvent
        if (updatedBusinessUserAttributes?.linkedEntities) {
          await userManagementService.validateLinkedEntitiesAndEmitEvent(
            updatedBusinessUserAttributes?.linkedEntities,
            userEvent.userId
          )
        }
        const lockKrs = lockKycRiskLevel
          ? lockKycRiskLevel === 'true'
          : undefined
        const isDrsUpdatable = lockCraRiskLevel
          ? lockCraRiskLevel !== 'true'
          : undefined
        const result = await userManagementService.verifyBusinessUserEvent(
          userEvent,
          allowUserTypeConversion === 'true',
          isDrsUpdatable,
          lockKrs
        )

        return {
          ...result,
          ...filterLiveRules(result),
        }
      }
    )

    const getUserEventHandler = async (_ctx, { eventId }) => {
      const userEventRepository = new UserEventRepository(tenantId, {
        mongoDb,
      })
      const result = await userEventRepository.getMongoUserEvent(eventId)
      if (!result) {
        throw new NotFound(`User event ${eventId} not found`)
      }
      return result
    }

    handlers.registerGetBatchBusinessUserEvents(async (ctx, request) => {
      const { batchId, page, pageSize } = request
      const batchImportService = new BatchImportService(ctx.tenantId, {
        dynamoDb,
        mongoDb,
      })
      return await batchImportService.getBatchBusinessUserEvents(batchId, {
        page,
        pageSize,
      })
    })
    handlers.registerGetBatchConsumerUserEvents(async (ctx, request) => {
      const { batchId, page, pageSize } = request
      const batchImportService = new BatchImportService(ctx.tenantId, {
        dynamoDb,
        mongoDb,
      })
      return await batchImportService.getBatchConsumerUserEvents(batchId, {
        page,
        pageSize,
      })
    })

    handlers.registerGetConsumerUserEvent(getUserEventHandler)
    handlers.registerGetBusinessUserEvent(getUserEventHandler)

    return await handlers.handle(event)
  }
)
