import { Credentials } from '@aws-sdk/client-sts'
import {
  APIGatewayEventLambdaAuthorizerContext,
  APIGatewayProxyWithLambdaAuthorizerEvent,
} from 'aws-lambda'
import createHttpError from 'http-errors'
import { lambdaApi } from '@/core/middlewares/lambda-api-middlewares'
import { UserService } from '@/services/users'
import { Handlers } from '@/@types/openapi-public-management-custom/DefaultApi'

export const userHandler = lambdaApi()(
  async (
    event: APIGatewayProxyWithLambdaAuthorizerEvent<
      APIGatewayEventLambdaAuthorizerContext<Credentials>
    >
  ) => {
    const userService = await UserService.fromEvent(event)
    const handlers = new Handlers()

    handlers.registerGetUserComments(async (ctx, request) => {
      const userId = request.userId
      return await userService.getUserCommentsExternal(userId)
    })

    handlers.registerPostUserComment(async (ctx, request) => {
      const userId = request.userId
      const payload = request.CommentRequest
      return await userService.saveUserCommentExternal(userId, payload)
    })

    handlers.registerGetUserComment(async (ctx, request) => {
      const userId = request.userId
      const commentId = request.commentId
      return await userService.getUserComment(userId, commentId)
    })

    handlers.registerDeleteUserComment(async (ctx, request) => {
      const userId = request.userId
      const commentId = request.commentId
      await userService.deleteUserComment(userId, commentId)
    })

    handlers.registerGetUsersSearch(async (ctx, request) => {
      if (!request.name && !request.email) {
        throw new createHttpError.BadRequest('Please provide a valid query')
      }

      return await userService.searchUsers(request)
    })

    return handlers.handle(event)
  }
)
