import {
  APIGatewayEventLambdaAuthorizerContext,
  APIGatewayProxyWithLambdaAuthorizerEvent,
} from 'aws-lambda'
import { Forbidden, NotFound } from 'http-errors'
import { compact } from 'lodash'
import { UserService } from './services/user-service'
import { UserAuditLogService } from './services/user-audit-log-service'
import { JWTAuthorizerResult } from '@/@types/jwt'
import { lambdaApi } from '@/core/middlewares/lambda-api-middlewares'
import { getS3ClientByEvent } from '@/utils/s3'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import { getDynamoDbClientByEvent } from '@/utils/dynamodb'
import { CrmService } from '@/services/crm'
import { hasFeature } from '@/core/utils/context'
import { RuleInstanceRepository } from '@/services/rules-engine/repositories/rule-instance-repository'
import { AlertsRepository } from '@/services/rules-engine/repositories/alerts-repository'
import { Handlers } from '@/@types/openapi-internal-custom/DefaultApi'
import { LinkerService } from '@/services/linker'
import { UserEventRepository } from '@/services/rules-engine/repositories/user-event-repository'

export type UserViewConfig = {
  TMP_BUCKET: string
  DOCUMENT_BUCKET: string
}

export const businessUsersViewHandler = lambdaApi()(
  async (
    event: APIGatewayProxyWithLambdaAuthorizerEvent<
      APIGatewayEventLambdaAuthorizerContext<JWTAuthorizerResult>
    >
  ) => {
    const { principalId: tenantId } = event.requestContext.authorizer
    const { DOCUMENT_BUCKET, TMP_BUCKET } = process.env as UserViewConfig
    const s3 = getS3ClientByEvent(event)
    const client = await getMongoDbClient()
    const dynamoDb = getDynamoDbClientByEvent(event)
    const userService = new UserService(
      tenantId,
      { mongoDb: client, dynamoDb },
      s3,
      TMP_BUCKET,
      DOCUMENT_BUCKET
    )
    const userAuditLogService = new UserAuditLogService(tenantId)
    const handlers = new Handlers()

    handlers.registerGetBusinessUsersList(
      async (ctx, request) => await userService.getBusinessUsers(request)
    )

    handlers.registerGetBusinessUsersItem(async (ctx, request) => {
      const user = await userService.getBusinessUser(request.userId)
      if (user == null) {
        throw new NotFound(`Unable to find user by id`)
      }
      await userAuditLogService.handleAuditLogForUserViewed(request.userId)
      return user
    })

    handlers.registerPostBusinessUsersUserId(async (ctx, request) => {
      await userAuditLogService.handleAuditLogForUserUpdate(
        request.UserUpdateRequest,
        request.userId
      )
      return await userService.updateBusinessUser(
        request.userId,
        request.UserUpdateRequest
      )
    })

    handlers.registerGetUsersUniques(async (ctx, request) =>
      compact(await userService.getUniques(request))
    )

    return await handlers.handle(event)
  }
)

export const consumerUsersViewHandler = lambdaApi()(
  async (
    event: APIGatewayProxyWithLambdaAuthorizerEvent<
      APIGatewayEventLambdaAuthorizerContext<JWTAuthorizerResult>
    >
  ) => {
    const { principalId: tenantId } = event.requestContext.authorizer
    const { DOCUMENT_BUCKET, TMP_BUCKET } = process.env as UserViewConfig
    const s3 = getS3ClientByEvent(event)
    const client = await getMongoDbClient()
    const dynamoDb = getDynamoDbClientByEvent(event)
    const userService = new UserService(
      tenantId,
      {
        mongoDb: client,
        dynamoDb,
      },
      s3,
      TMP_BUCKET,
      DOCUMENT_BUCKET
    )
    const userAuditLogService = new UserAuditLogService(tenantId)
    const handlers = new Handlers()

    handlers.registerGetConsumerUsersList(
      async (ctx, request) => await userService.getConsumerUsers(request)
    )

    handlers.registerGetConsumerUsersItem(async (ctx, request) => {
      const user = await userService.getConsumerUser(request.userId)
      if (user == null) {
        throw new NotFound(`Unable to find user by id`)
      }
      await userAuditLogService.handleAuditLogForUserViewed(request.userId)
      return user
    })

    handlers.registerPostConsumerUsersUserId(async (ctx, request) => {
      await userAuditLogService.handleAuditLogForUserUpdate(
        request.UserUpdateRequest,
        request.userId
      )
      return await userService.updateConsumerUser(
        request.userId,
        request.UserUpdateRequest
      )
    })

    return await handlers.handle(event)
  }
)

export const allUsersViewHandler = lambdaApi()(
  async (
    event: APIGatewayProxyWithLambdaAuthorizerEvent<
      APIGatewayEventLambdaAuthorizerContext<JWTAuthorizerResult>
    >
  ) => {
    const { principalId: tenantId, userId } = event.requestContext.authorizer
    const { DOCUMENT_BUCKET, TMP_BUCKET } = process.env as UserViewConfig
    const s3 = getS3ClientByEvent(event)
    const client = await getMongoDbClient()
    const dynamoDb = getDynamoDbClientByEvent(event)
    const userService = new UserService(
      tenantId,
      {
        mongoDb: client,
        dynamoDb,
      },
      s3,
      TMP_BUCKET,
      DOCUMENT_BUCKET
    )

    const userEventsRepository = new UserEventRepository(tenantId, {
      dynamoDb,
      mongoDb: client,
    })

    const alertsRepository = new AlertsRepository(tenantId, {
      mongoDb: client,
      dynamoDb,
    })

    const ruleInstanceRepository = new RuleInstanceRepository(tenantId, {
      dynamoDb,
    })
    const linkerService = new LinkerService(tenantId)
    const userAuditLogService = new UserAuditLogService(tenantId)
    const handlers = new Handlers()

    handlers.registerGetAllUsersList(
      async (ctx, request) => await userService.getUsers(request)
    )
    handlers.registerGetUsersItem(
      async (ctx, request) => await userService.getUser(request.userId)
    )

    handlers.registerPostUserComments(async (ctx, request) => {
      const comment = {
        ...request.Comment,
        userId,
      }
      const createdComment = await userService.saveUserComment(
        request.userId,
        comment
      )
      await userAuditLogService.handleAuditLogForAddComment(
        userId,
        createdComment
      )
      return createdComment
    })

    handlers.registerDeleteUsersUserIdCommentsCommentId(
      async (ctx, request) => {
        const comment = (
          await userService.getUser(request.userId)
        ).comments?.find((comment) => comment.id === request.commentId)

        await userService.deleteUserComment(request.userId, request.commentId)

        if (comment) {
          await userAuditLogService.handleAuditLogForDeleteComment(
            userId,
            comment
          )
        }
      }
    )

    handlers.registerGetEventsList(async (ctx, request) => {
      const userEvents = await userEventsRepository.getMongoUserEvents(request)
      const count = await userEventsRepository.getUserEventsCount(
        request.userId
      )

      return {
        items: userEvents,
        total: count,
      }
    })

    handlers.registerGetCrmAccount(async (ctx, request) => {
      if (!hasFeature('CRM')) {
        throw new Forbidden('CRM feature not enabled')
      }
      const user = await userService.getUser(request.userId)
      const crmAccountId = user.tags?.find(
        (t) => t.key === 'crmAccountId'
      )?.value

      if (!crmAccountId) {
        return null
      }
      return await new CrmService(tenantId).getAccount(crmAccountId)
    })

    handlers.registerGetUserEntity(async (ctx, request) => {
      const entity = await linkerService.entity(request.userId)
      return linkerService.visualisation(
        request.userId,
        entity.userLabels,
        entity.emailLinked,
        entity.addressLinked,
        entity.phoneLinked,
        entity.paymentMethodLinked
      )
    })

    handlers.registerGetTxnLinking(async (ctx, request) => {
      return linkerService.transactions(request.userId)
    })

    handlers.registerGetUserScreeningStatus(async (ctx, request) => {
      const user = await userService.getUser(request.userId)
      const ruleInstances = await ruleInstanceRepository.getAllRuleInstances()
      const ongoingRuleInstanceIds: string[] = ruleInstances
        .filter(
          (ruleInstance) =>
            ruleInstance.type === 'USER' &&
            ruleInstance.parameters?.ongoingScreening
        )
        .map((x) => x.id)
        .filter((x): x is string => typeof x === 'string')

      if (ongoingRuleInstanceIds.length === 0) {
        return {
          isOngoingScreening: false,
        }
      }
      const alerts = await alertsRepository.getAlerts({
        filterUserId: user.userId,
        filterRuleInstanceId: ongoingRuleInstanceIds,
        pageSize: 1,
      })
      return {
        isOngoingScreening: alerts.data.length > 0,
      }
    })

    return await handlers.handle(event)
  }
)
