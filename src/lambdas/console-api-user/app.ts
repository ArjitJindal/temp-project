import {
  APIGatewayEventLambdaAuthorizerContext,
  APIGatewayProxyWithLambdaAuthorizerEvent,
} from 'aws-lambda'
import { NotFound } from 'http-errors'
import { UserService } from './services/user-service'
import { UserAuditLogService } from './services/user-audit-log-service'
import { JWTAuthorizerResult } from '@/@types/jwt'
import { lambdaApi } from '@/core/middlewares/lambda-api-middlewares'
import { getS3Client } from '@/utils/s3'
import { getMongoDbClient } from '@/utils/mongoDBUtils'
import { getDynamoDbClientByEvent } from '@/utils/dynamodb'
import { UserUpdateRequest } from '@/@types/openapi-internal/UserUpdateRequest'
import { FileInfo } from '@/@types/openapi-internal/FileInfo'
import { Comment } from '@/@types/openapi-internal/Comment'

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
    const s3 = getS3Client(event)
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

    if (event.httpMethod === 'GET' && event.path.endsWith('/business/users')) {
      const {
        page,
        pageSize,
        afterTimestamp,
        beforeTimestamp,
        filterId,
        filterName,
        filterOperator,
        filterBusinessIndustries,
        filterRiskLevel,
      } = event.queryStringParameters as any
      return userService.getBusinessUsers({
        page,
        pageSize,
        afterTimestamp: parseInt(afterTimestamp) || undefined,
        beforeTimestamp: parseInt(beforeTimestamp),
        filterId,
        filterName,
        filterOperator,
        filterBusinessIndustries: filterBusinessIndustries
          ? filterBusinessIndustries.split(',')
          : undefined,
        filterRiskLevel: filterRiskLevel
          ? filterRiskLevel.split(',')
          : undefined,
      })
    } else if (
      event.httpMethod === 'GET' &&
      event.resource === '/business/users/{userId}' &&
      event.pathParameters?.userId
    ) {
      const user = await userService.getBusinessUser(
        event.pathParameters?.userId
      )
      if (user == null) {
        throw new NotFound(`Unable to find user by id`)
      }
      const caseAuditLogService = new UserAuditLogService(tenantId)
      await caseAuditLogService.handleAuditLogForuserViewed(
        event.pathParameters?.userId
      )
      return user
    } else if (
      event.httpMethod === 'POST' &&
      event.resource === '/business/users/{userId}' &&
      event.pathParameters?.userId &&
      event.body
    ) {
      const updateRequest = JSON.parse(event.body) as UserUpdateRequest
      return userService.updateBusinessUser(
        event.pathParameters.userId,
        updateRequest
      )
    } else if (
      event.httpMethod === 'POST' &&
      event.resource === '/business/users/{userId}/files' &&
      event.pathParameters?.userId &&
      event.body
    ) {
      const fileInfo = JSON.parse(event.body) as FileInfo
      await userService.saveUserFile(event.pathParameters.userId, fileInfo)
      return 'OK'
    } else if (
      event.httpMethod === 'DELETE' &&
      event.resource === '/business/users/{userId}/files/{fileId}' &&
      event.pathParameters?.userId &&
      event.pathParameters?.fileId
    ) {
      await userService.deleteUserFile(
        event.pathParameters.userId,
        event.pathParameters.fileId
      )
      return 'OK'
    } else if (
      event.httpMethod === 'GET' &&
      event.path.endsWith('/business/users/uniques')
    ) {
      return await userService.getUniques()
    }
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
    const s3 = getS3Client(event)
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
    if (event.httpMethod === 'GET' && event.path.endsWith('/consumer/users')) {
      const {
        page,
        pageSize,
        afterTimestamp,
        beforeTimestamp,
        filterId,
        filterName,
        filterOperator,
        filterRiskLevel,
      } = event.queryStringParameters as any
      return userService.getConsumerUsers({
        page,
        pageSize,
        afterTimestamp: parseInt(afterTimestamp) || undefined,
        beforeTimestamp: parseInt(beforeTimestamp),
        filterId,
        filterName,
        filterOperator,
        filterRiskLevel: filterRiskLevel
          ? filterRiskLevel.split(',')
          : undefined,
      })
    } else if (event.httpMethod === 'GET' && event.path.endsWith('/users')) {
      const {
        page,
        pageSize,
        afterTimestamp,
        beforeTimestamp,
        filterId,
        filterName,
        filterOperator,
        filterRiskLevel,
      } = event.queryStringParameters as any
      return userService.getUsers({
        page,
        pageSize,
        afterTimestamp: parseInt(afterTimestamp) || undefined,
        beforeTimestamp: parseInt(beforeTimestamp),
        filterId,
        filterName,
        filterOperator,
        filterRiskLevel: filterRiskLevel
          ? filterRiskLevel.split(',')
          : undefined,
      })
    } else if (
      event.httpMethod === 'POST' &&
      event.resource === '/users/{userId}/comments' &&
      event.pathParameters?.userId &&
      event.body
    ) {
      const comment = JSON.parse(event.body) as Comment
      const savedComment: Comment = await userService.saveUserComment(
        event.pathParameters.userId,
        comment
      )
      return savedComment
    } else if (
      event.httpMethod === 'DELETE' &&
      event.pathParameters?.userId &&
      event.pathParameters?.commentId
    ) {
      return userService.deleteUserComment(
        event.pathParameters.userId,
        event.pathParameters.commentId
      )
    } else if (
      event.httpMethod === 'GET' &&
      event.resource === '/consumer/users/{userId}' &&
      event.pathParameters?.userId
    ) {
      const user = await userService.getConsumerUser(
        event.pathParameters?.userId
      )
      if (user == null) {
        throw new NotFound(`Unable to find user by id`)
      }
      const caseAuditLogService = new UserAuditLogService(tenantId)
      await caseAuditLogService.handleAuditLogForuserViewed(
        event.pathParameters?.userId
      )
      return user
    } else if (
      event.httpMethod === 'POST' &&
      event.resource === '/consumer/users/{userId}' &&
      event.pathParameters?.userId &&
      event.body
    ) {
      const updateRequest = JSON.parse(event.body) as UserUpdateRequest
      return userService.updateConsumerUser(
        event.pathParameters.userId,
        updateRequest
      )
    } else if (
      event.httpMethod === 'POST' &&
      event.resource === '/consumer/users/{userId}/files' &&
      event.pathParameters?.userId &&
      event.body
    ) {
      const fileInfo = JSON.parse(event.body) as FileInfo
      await userService.saveUserFile(event.pathParameters.userId, fileInfo)
      return 'OK'
    } else if (
      event.httpMethod === 'DELETE' &&
      event.resource === '/consumer/users/{userId}/files/{fileId}' &&
      event.pathParameters?.userId &&
      event.pathParameters?.fileId
    ) {
      await userService.deleteUserFile(
        event.pathParameters.userId,
        event.pathParameters.fileId
      )
      return 'OK'
    }
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
    const s3 = getS3Client(event)
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
    if (event.httpMethod === 'GET' && event.path.endsWith('/users')) {
      const {
        page,
        pageSize,
        afterTimestamp,
        beforeTimestamp,
        filterId,
        filterName,
        filterOperator,
        includeCasesCount,
      } = event.queryStringParameters as any
      return userService.getUsers({
        page,
        pageSize,
        afterTimestamp: parseInt(afterTimestamp) || undefined,
        beforeTimestamp: parseInt(beforeTimestamp),
        filterId,
        filterName,
        filterOperator,
        includeCasesCount: includeCasesCount === 'true',
      })
    } else if (
      event.httpMethod === 'POST' &&
      event.resource === '/users/{userId}/comments' &&
      event.pathParameters?.userId &&
      event.body
    ) {
      const comment = JSON.parse(event.body) as Comment
      const savedComment: Comment = await userService.saveUserComment(
        event.pathParameters.userId,
        { ...comment, userId }
      )
      return savedComment
    } else if (
      event.resource === '/users/{userId}/comments/{commentId}' &&
      event.httpMethod === 'DELETE' &&
      event.pathParameters?.userId &&
      event.pathParameters?.commentId
    ) {
      return userService.deleteUserComment(
        event.pathParameters.userId,
        event.pathParameters.commentId
      )
    }
    throw new Error('Unhandled request')
  }
)
