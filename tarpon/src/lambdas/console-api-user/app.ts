import {
  APIGatewayEventLambdaAuthorizerContext,
  APIGatewayProxyWithLambdaAuthorizerEvent,
} from 'aws-lambda'
import { BadRequest, Forbidden, NotFound } from 'http-errors'
import compact from 'lodash/compact'
import { UserService } from '../../services/users'
import { JWTAuthorizerResult } from '@/@types/jwt'
import { lambdaApi } from '@/core/middlewares/lambda-api-middlewares'
import { CrmService } from '@/services/crm'
import { hasFeature } from '@/core/utils/context'
import { Handlers } from '@/@types/openapi-internal-custom/DefaultApi'
import { LinkerService } from '@/services/linker'
import { getOngoingScreeningUserRuleInstances } from '@/services/batch-jobs/ongoing-screening-user-rule-batch-job-runner'
import { Comment } from '@/@types/openapi-internal/Comment'
import { getMentionsFromComments } from '@/utils/helpers'
import { getDynamoDbClientByEvent } from '@/utils/dynamodb'
import { isClickhouseEnabled } from '@/utils/clickhouse/utils'
import { EddService } from '@/services/edd'
import { getMongoDbClient } from '@/utils/mongodb-utils'

export const businessUsersViewHandler = lambdaApi()(
  async (
    event: APIGatewayProxyWithLambdaAuthorizerEvent<
      APIGatewayEventLambdaAuthorizerContext<JWTAuthorizerResult>
    >
  ) => {
    const userService = await UserService.fromEvent(event)
    const handlers = new Handlers()

    handlers.registerGetBusinessUsersList(async (ctx, request) => {
      if (isClickhouseEnabled()) {
        if (request.responseType === 'count') {
          const count = await userService.getBusinessUsersV2Count(request)
          return { items: [], count }
        }
        if (request.responseType === 'data') {
          const items = await userService.getBusinessUsersV2(request)
          return { items, count: 0 }
        }
        const count = await userService.getBusinessUsersV2Count(request)
        const items = await userService.getBusinessUsersV2(request)
        return { items, count }
      }
      if (request.responseType === 'count') {
        const count = await userService.getBusinessUsersCount(request)
        return { items: [], count }
      }
      if (request.responseType === 'data') {
        const items = await userService.getBusinessUsers(request)
        return { items, count: 0 }
      }
      const count = await userService.getBusinessUsersCount(request)
      const items = await userService.getBusinessUsers(request)
      return { items, count }
    })

    handlers.registerGetBusinessUsersItem(async (ctx, request) => {
      const user = await userService.getBusinessUser(request.userId)
      if (user.result == null) {
        throw new NotFound(`Unable to find user by id`)
      }
      return user.result
    })

    handlers.registerPostBusinessUsersUserId(async (ctx, request) => {
      const user = await userService.getUser(request.userId, false)
      return (await userService.updateUser(user, request.UserUpdateRequest))
        .result
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
    const userService = await UserService.fromEvent(event)
    const handlers = new Handlers()

    handlers.registerGetConsumerUsersList(async (ctx, request) => {
      if (isClickhouseEnabled()) {
        if (request.responseType === 'count') {
          const count = await userService.getConsumerUsersV2Count(request)
          return { items: [], count }
        }
        if (request.responseType === 'data') {
          const items = await userService.getConsumerUsersV2(request)
          return { items, count: 0 }
        }
        const count = await userService.getConsumerUsersV2Count(request)
        const items = await userService.getConsumerUsersV2(request)
        return { items, count }
      }
      if (request.responseType === 'count') {
        const count = await userService.getConsumerUsersCount(request)
        return { items: [], count }
      }
      if (request.responseType === 'data') {
        const items = await userService.getConsumerUsers(request)
        return { items, count: 0 }
      }
      const count = await userService.getConsumerUsersCount(request)
      const items = await userService.getConsumerUsers(request)
      return { items, count }
    })

    handlers.registerGetConsumerUsersItem(async (ctx, request) => {
      const user = await userService.getConsumerUser(request.userId)
      if (user.result == null) {
        throw new NotFound(`Unable to find user by id`)
      }
      return user.result
    })

    handlers.registerPostConsumerUsersUserId(async (ctx, request) => {
      const user = await userService.getUser(request.userId, false)
      return (await userService.updateUser(user, request.UserUpdateRequest))
        .result
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
        if (request.responseType === 'count') {
          const count = await userService.getClickhouseUsersCount(request)
          return { items: [], count }
        }
        if (request.responseType === 'data') {
          const items = await userService.getClickhouseUsers(request)
          return { items, count: 0 }
        }
        const count = await userService.getClickhouseUsersCount(request)
        const items = await userService.getClickhouseUsers(request)
        return { items, count }
      }
      if (request.responseType === 'count') {
        const count = await userService.getUsersCount(request)
        return { items: [], count }
      }
      if (request.responseType === 'data') {
        const items = (await userService.getUsers(request)).result
        return { items, count: 0 }
      }
      const count = await userService.getUsersCount(request)
      const items = (await userService.getUsers(request)).result
      return { items, count }
    })

    handlers.registerGetAllUsersPreviewList(async (ctx, request) => {
      return await userService.getUsersPreview(request)
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
      return createdComment.result
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

    handlers.registerGetUserEntityChildUsers(async (_ctx, request) => {
      const result = await userService.getUserEntityChildUsers(request)
      return result
    })

    handlers.registerGetUserEntityParentUser(async (_ctx, request) => {
      const result = await userService.getUserEntityParentUser(request.userId)
      return result
    })

    handlers.registerGetTxnLinking(async (ctx, request) => {
      return linkerService.transactions(
        request.userId,
        request?.afterTimestamp,
        request?.beforeTimestamp
      )
    })

    handlers.registerGetUserScreeningStatus(async (_ctx, _request) => {
      const dynamoDb = getDynamoDbClientByEvent(event)
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
      return createdComment.result
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

    // User Approval Routes
    handlers.registerPostUserApprovalProposal(async (ctx, request) => {
      const { proposedChanges, comment } = request.UserApprovalUpdateRequest
      const response = await userService.proposeUserFieldChange(
        request.userId,
        proposedChanges[0],
        comment,
        userId
      )
      return response.result
    })

    handlers.registerGetUserApprovalProposal(async (ctx, request) => {
      const proposalId = parseInt(request.id, 10)
      if (isNaN(proposalId)) {
        throw new BadRequest('Invalid id parameter: must be a valid number')
      }

      const approval = await userService.getUserApprovalProposal(
        request.userId,
        proposalId
      )
      if (!approval) {
        throw new NotFound('User approval proposal not found')
      }
      return approval
    })

    handlers.registerGetUserApprovalProposals(async (ctx, request) => {
      return await userService.getUserApprovalProposals(request.userId)
    })

    handlers.registerGetAllUserApprovalProposals(async (_ctx, _request) => {
      return await userService.listUserApprovalProposals()
    })

    handlers.registerPostUserApprovalProcess(async (ctx, request) => {
      const proposalId = parseInt(request.id, 10)
      if (isNaN(proposalId)) {
        throw new BadRequest('Invalid id parameter: must be a valid number')
      }

      const response = await userService.processUserApproval(
        request.userId,
        proposalId,
        request.UserApprovalRequest
      )
      return response.result
    })

    handlers.registerGetUsersUserIdEddReviews(async (ctx, request) => {
      const mongoDb = await getMongoDbClient()
      return await new EddService(tenantId, mongoDb).getEddReviews(
        request.userId
      )
    })

    handlers.registerGetUsersUserIdEddReviewsEddReviewId(
      async (ctx, request) => {
        const mongoDb = await getMongoDbClient()
        return await new EddService(tenantId, mongoDb).getEddReview(
          request.userId,
          request.eddReviewId
        )
      }
    )

    handlers.registerPatchUsersUserIdEddReviewsEddReviewId(
      async (ctx, request) => {
        const mongoDb = await getMongoDbClient()
        return await new EddService(tenantId, mongoDb).updateEddReview(
          request.userId,
          request.eddReviewId,
          request.EDDReviewUpdateRequest.review
        )
      }
    )

    return await handlers.handle(event)
  }
)
