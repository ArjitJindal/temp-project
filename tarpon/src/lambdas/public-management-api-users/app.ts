import { Credentials } from '@aws-sdk/client-sts'
import {
  APIGatewayEventLambdaAuthorizerContext,
  APIGatewayProxyWithLambdaAuthorizerEvent,
} from 'aws-lambda'
import { CommentRequest } from '@/@types/openapi-public-management/CommentRequest'
import { lambdaApi } from '@/core/middlewares/lambda-api-middlewares'
import { UserService } from '@/services/users'

export const userHandler = lambdaApi()(
  async (
    event: APIGatewayProxyWithLambdaAuthorizerEvent<
      APIGatewayEventLambdaAuthorizerContext<Credentials>
    >
  ) => {
    const userService = await UserService.fromEvent(event)
    if (
      event.httpMethod === 'GET' &&
      event.resource === '/users/{userId}/comments' &&
      event.pathParameters?.userId
    ) {
      const userId = event.pathParameters?.userId
      return await userService.getUserCommentsExternal(userId)
    } else if (
      event.httpMethod === 'POST' &&
      event.resource === '/users/{userId}/comments' &&
      event.pathParameters?.userId &&
      event.body
    ) {
      const userId = event.pathParameters?.userId
      const payload = JSON.parse(event.body) as CommentRequest
      return await userService.saveUserCommentExternal(userId, payload)
    } else if (
      event.httpMethod === 'GET' &&
      event.resource === '/users/{userId}/comments/{commentId}' &&
      event.pathParameters?.userId &&
      event.pathParameters?.commentId
    ) {
      const userId = event.pathParameters?.userId
      const commentId = event.pathParameters?.commentId
      return await userService.getUserComment(userId, commentId)
    } else if (
      event.httpMethod === 'DELETE' &&
      event.resource === '/users/{userId}/comments/{commentId}' &&
      event.pathParameters?.userId &&
      event.pathParameters?.commentId
    ) {
      const userId = event.pathParameters?.userId
      const commentId = event.pathParameters?.commentId
      return await userService.deleteUserComment(userId, commentId)
    }
    return 'Unhandled request'
  }
)
