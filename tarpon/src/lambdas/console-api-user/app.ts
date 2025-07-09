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
import { CrmService } from '@/services/crm'
import { hasFeature } from '@/core/utils/context'
import { Handlers } from '@/@types/openapi-internal-custom/DefaultApi'
import { LinkerService } from '@/services/linker'
import { getOngoingScreeningUserRuleInstances } from '@/services/batch-jobs/ongoing-screening-user-rule-batch-job-runner'
import { Comment } from '@/@types/openapi-internal/Comment'
import { getMentionsFromComments } from '@/utils/helpers'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { isClickhouseEnabled } from '@/utils/clickhouse/utils'

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

    const userService = await UserService.fromEvent(event)
    const userAuditLogService = new UserAuditLogService(tenantId)
    const handlers = new Handlers()

    handlers.registerGetBusinessUsersList(async (ctx, request) => {
      if (isClickhouseEnabled()) {
        return await userService.getBusinessUsersV2(request)
      }
      return await userService.getBusinessUsers(request)
    })

    handlers.registerGetBusinessUsersItem(async (ctx, request) => {
      const user = await userService.getBusinessUser(request.userId)
      if (user == null) {
        throw new NotFound(`Unable to find user by id`)
      }
      await userAuditLogService.handleAuditLogForUserViewed(request.userId)
      return user
    })

    handlers.registerPostBusinessUsersUserId(async (ctx, request) => {
      const user = await userService.getUser(request.userId, false)
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
    const userService = await UserService.fromEvent(event)
    const userAuditLogService = new UserAuditLogService(tenantId)
    const handlers = new Handlers()

    handlers.registerGetConsumerUsersList(async (ctx, request) => {
      if (isClickhouseEnabled()) {
        return await userService.getConsumerUsersV2(request)
      }
      return await userService.getConsumerUsers(request)
    })

    handlers.registerGetConsumerUsersItem(async (ctx, request) => {
      const user = await userService.getConsumerUser(request.userId)
      if (user == null) {
        throw new NotFound(`Unable to find user by id`)
      }
      await userAuditLogService.handleAuditLogForUserViewed(request.userId)
      return user
    })

    handlers.registerPostConsumerUsersUserId(async (ctx, request) => {
      const user = await userService.getUser(request.userId, false)
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
    const userService = await UserService.fromEvent(event)
    const linkerService = new LinkerService(tenantId)
    const handlers = new Handlers()

    handlers.registerGetAllUsersList(async (ctx, request) => {
      if (isClickhouseEnabled()) {
        return await userService.getClickhouseUsers(request)
      }
      return (await userService.getUsers(request)).result
    })

    handlers.registerGetUsersItem(
      async (ctx, request) => await userService.getUser(request.userId, true)
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
      return createdComment
    })

    handlers.registerDeleteUsersUserIdCommentsCommentId(
      async (ctx, request) => {
        const response = await userService.deleteUserComment(
          request.userId,
          request.commentId
        )

        return response.result
      }
    )

    handlers.registerGetEventsList(
      async (ctx, request) => await userService.getEventsList(request)
    )

    handlers.registerGetCrmAccount(async (ctx, request) => {
      if (!hasFeature('CRM')) {
        throw new Forbidden('CRM feature not enabled')
      }
      const user = await userService.getUser(request.userId, false)
      const crmAccountId = user.tags?.find(
        (t) => t.key === 'crmAccountId'
      )?.value

      if (!crmAccountId) {
        return null
      }
      return await new CrmService(tenantId).getAccount(crmAccountId)
    })

    handlers.registerGetUserEntity(async (ctx, request) => {
      return await linkerService.entityGraph(
        request.userId,
        request?.afterTimestamp,
        request?.beforeTimestamp
      )
    })

    handlers.registerGetUserEntityNodesOnly(async (ctx, request) => {
      return await linkerService.entityGraphNodesOnly(request.userId)
    })

    handlers.registerGetTxnLinking(async (ctx, request) => {
      return linkerService.transactions(
        request.userId,
        request?.afterTimestamp,
        request?.beforeTimestamp
      )
    })

    handlers.registerGetUserScreeningStatus(async (_ctx, _request) => {
      const dynamoDb = getDynamoDbClient()
      const ongoingScreeningUserRules =
        await getOngoingScreeningUserRuleInstances(tenantId, dynamoDb)

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
      return createdComment
    })

    handlers.registerPostUserAttachment(async (ctx, request) => {
      return await userService.saveUserAttachment(
        request.userId,
        request.personId,
        request.personType,
        request.UserAttachmentUpdateRequest.attachment
      )
    })

    handlers.registerPostUsersFlatFileUpload(async (ctx, request) => {
      return await userService.importFlatFile(request.UserFlatFileUploadRequest)
    })

    return await handlers.handle(event)
  }
)
