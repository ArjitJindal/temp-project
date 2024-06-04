import {
  APIGatewayEventLambdaAuthorizerContext,
  APIGatewayProxyWithLambdaAuthorizerEvent,
} from 'aws-lambda'
import { Forbidden, NotFound } from 'http-errors'
import { compact } from 'lodash'
import { UserService } from '../../services/users'
import { UserAuditLogService } from './services/user-audit-log-service'
import { JWTAuthorizerResult } from '@/@types/jwt'
import { lambdaApi } from '@/core/middlewares/lambda-api-middlewares'
import { getS3ClientByEvent } from '@/utils/s3'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import { getDynamoDbClientByEvent } from '@/utils/dynamodb'
import { CrmService } from '@/services/crm'
import { hasFeature } from '@/core/utils/context'
import { Handlers } from '@/@types/openapi-internal-custom/DefaultApi'
import { LinkerService } from '@/services/linker'
import { getOngoingScreeningUserRuleInstances } from '@/services/batch-jobs/ongoing-screening-user-rule-batch-job-runner'
import { Comment } from '@/@types/openapi-internal/Comment'
import { getMentionsFromComments, getParsedCommentBody } from '@/utils/helpers'

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
      const user = await userService.getUser(request.userId)
      return await userService.updateUser(user, request.UserUpdateRequest)
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
      const user = await userService.getUser(request.userId)
      return await userService.updateUser(user, request.UserUpdateRequest)
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
    const mongoDb = await getMongoDbClient()
    const dynamoDb = getDynamoDbClientByEvent(event)
    const userService = new UserService(
      tenantId,
      { mongoDb, dynamoDb },
      s3,
      TMP_BUCKET,
      DOCUMENT_BUCKET
    )

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
      const { CommentRequest: rawComment } = request
      const mentions = getMentionsFromComments(rawComment.body)
      const comment = {
        ...rawComment,
        userId,
        mentions,
      }
      const createdComment = await userService.saveUserComment(
        request.userId,
        comment
      )
      await userAuditLogService.handleAuditLogForAddComment(request.userId, {
        ...rawComment,
        mentions,
        body: getParsedCommentBody(rawComment.body),
      })
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
            request.userId,
            comment
          )
        }
      }
    )

    handlers.registerGetEventsList(
      async (ctx, request) => await userService.getEventsList(request)
    )

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
      return await linkerService.entityGraph(request.userId)
    })

    handlers.registerGetTxnLinking(async (ctx, request) => {
      return linkerService.transactions(request.userId)
    })

    handlers.registerGetUserScreeningStatus(async (_ctx, _request) => {
      const ongoingScreeningUserRules =
        await getOngoingScreeningUserRuleInstances(tenantId)

      return { isOngoingScreening: ongoingScreeningUserRules.length > 0 }
    })

    handlers.registerGetRuleInstancesTransactionUsersHit(
      async (ctx, request) =>
        await userService.getRuleInstancesTransactionUsersHit(
          request.ruleInstanceId,
          request
        )
    )

    handlers.registerPostUsersCommentsReply(async (ctx, request) => {
      const { CommentRequest: rawComment } = request
      const mentions = getMentionsFromComments(rawComment.body)
      const comment: Comment = { ...rawComment, userId, mentions }

      const createdComment = await userService.saveUserCommentReply(
        request.userId,
        request.commentId,
        comment
      )

      await userAuditLogService.handleAuditLogForAddComment(request.userId, {
        ...rawComment,
        mentions,
        body: getParsedCommentBody(rawComment.body),
      })
      return createdComment
    })

    return await handlers.handle(event)
  }
)
