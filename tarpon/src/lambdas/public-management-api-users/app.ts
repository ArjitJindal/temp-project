import { Credentials } from '@aws-sdk/client-sts'
import {
  APIGatewayEventLambdaAuthorizerContext,
  APIGatewayProxyWithLambdaAuthorizerEvent,
} from 'aws-lambda'
import createHttpError from 'http-errors'
import { CommentRequest } from '@/@types/openapi-public-management/CommentRequest'
import { lambdaApi } from '@/core/middlewares/lambda-api-middlewares'
import { UserService } from '@/services/users'
import { DefaultApiGetUsersSearchRequest } from '@/@types/openapi-public-management/RequestParameters'

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
      event.pathParameters?.userId
    ) {
      const userId = event.pathParameters?.userId
      const payload = JSON.parse(event.body || '{}') as CommentRequest
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
    } else if (
      event.httpMethod === 'GET' &&
      event.resource === '/users/search'
    ) {
      const query =
        event.queryStringParameters as DefaultApiGetUsersSearchRequest
      const { name, email } = query
      if (!name && !email) {
        throw new createHttpError.BadRequest('Please provide a valid query')
      }

      return await userService.searchUsers(query)
    }
    return 'Unhandled request'
  }
)
