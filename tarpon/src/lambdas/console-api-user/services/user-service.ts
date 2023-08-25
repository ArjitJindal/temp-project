import * as createError from 'http-errors'
import { MongoClient } from 'mongodb'
import { NotFound } from 'http-errors'
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb'
import { S3, GetObjectCommand, CopyObjectCommand } from '@aws-sdk/client-s3'
import {
  APIGatewayEventLambdaAuthorizerContext,
  APIGatewayProxyWithLambdaAuthorizerEvent,
} from 'aws-lambda'
import { Credentials } from '@aws-sdk/client-sts'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { omit } from 'lodash'
import { User } from '@/@types/openapi-public/User'
import { FileInfo } from '@/@types/openapi-internal/FileInfo'
import { UserRepository } from '@/services/users/repositories/user-repository'
import {
  DefaultApiGetAllUsersListRequest,
  DefaultApiGetBusinessUsersListRequest,
  DefaultApiGetConsumerUsersListRequest,
} from '@/@types/openapi-internal/RequestParameters'
import { BusinessUsersListResponse } from '@/@types/openapi-internal/BusinessUsersListResponse'
import { ConsumerUsersListResponse } from '@/@types/openapi-internal/ConsumerUsersListResponse'
import { InternalBusinessUser } from '@/@types/openapi-internal/InternalBusinessUser'
import { InternalConsumerUser } from '@/@types/openapi-internal/InternalConsumerUser'
import { UserUpdateRequest } from '@/@types/openapi-internal/UserUpdateRequest'
import { UserEventRepository } from '@/services/rules-engine/repositories/user-event-repository'
import { AllUsersListResponse } from '@/@types/openapi-internal/AllUsersListResponse'
import { InternalUser } from '@/@types/openapi-internal/InternalUser'
import { UsersUniquesField } from '@/@types/openapi-internal/UsersUniquesField'
import { Comment } from '@/@types/openapi-internal/Comment'
import { Business } from '@/@types/openapi-public/Business'
import { getS3ClientByEvent } from '@/utils/s3'
import { getContext } from '@/core/utils/context'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import { getDynamoDbClientByEvent } from '@/utils/dynamodb'
import { UserViewConfig } from '@/lambdas/console-api-user/app'
import { mergeObjects } from '@/utils/object'
import { traceable } from '@/core/xray'
import { Account } from '@/@types/openapi-internal/Account'
@traceable
export class UserService {
  userRepository: UserRepository
  userEventRepository: UserEventRepository
  s3: S3
  documentBucketName: string
  tmpBucketName: string

  constructor(
    tenantId: string,
    connections: {
      dynamoDb?: DynamoDBDocumentClient
      mongoDb?: MongoClient
    },
    s3: S3,
    tmpBucketName: string,
    documentBucketName: string
  ) {
    this.userRepository = new UserRepository(tenantId, {
      mongoDb: connections.mongoDb,
      dynamoDb: connections.dynamoDb,
    })
    this.userEventRepository = new UserEventRepository(tenantId, {
      mongoDb: connections.mongoDb,
      dynamoDb: connections.dynamoDb,
    })
    this.s3 = s3
    this.tmpBucketName = tmpBucketName
    this.documentBucketName = documentBucketName
  }

  public static async fromEvent(
    event: APIGatewayProxyWithLambdaAuthorizerEvent<
      APIGatewayEventLambdaAuthorizerContext<Credentials>
    >
  ): Promise<UserService> {
    const { principalId: tenantId } = event.requestContext.authorizer
    const { DOCUMENT_BUCKET, TMP_BUCKET } = process.env as UserViewConfig
    const s3 = getS3ClientByEvent(event)
    const client = await getMongoDbClient()
    const dynamoDb = getDynamoDbClientByEvent(event)
    return new UserService(
      tenantId,
      {
        mongoDb: client,
        dynamoDb,
      },
      s3,
      TMP_BUCKET,
      DOCUMENT_BUCKET
    )
  }

  public async getBusinessUsers(
    params: DefaultApiGetBusinessUsersListRequest
  ): Promise<BusinessUsersListResponse> {
    const result = await this.userRepository.getMongoBusinessUsers(params)
    const data = await Promise.all(
      result.data.map(
        async (user) => await this.getAugmentedUser<InternalBusinessUser>(user)
      )
    )
    return {
      ...result,
      data,
    }
  }

  public async getConsumerUsers(
    params: DefaultApiGetConsumerUsersListRequest
  ): Promise<ConsumerUsersListResponse> {
    const result = await this.userRepository.getMongoConsumerUsers(params)
    const data = await Promise.all(
      result.data.map(
        async (user) => await this.getAugmentedUser<InternalConsumerUser>(user)
      )
    )
    return {
      ...result,
      data,
    }
  }

  public async getUsers(
    params: DefaultApiGetAllUsersListRequest
  ): Promise<AllUsersListResponse> {
    const result = await this.userRepository.getMongoAllUsers(params)
    const data = await Promise.all(
      result.data.map(
        async (user) => await this.getAugmentedUser<InternalUser>(user)
      )
    )
    return {
      ...result,
      data,
    }
  }

  public async getUser(userId: string): Promise<InternalUser> {
    const usersListResponse = await this.getUsers({
      filterId: userId,
      beforeTimestamp: Number.MAX_SAFE_INTEGER,
    })

    if (usersListResponse.data && usersListResponse.data.length > 0) {
      return usersListResponse.data[0]
    }
    throw new NotFound('User not found')
  }

  public async getBusinessUser(
    userId: string
  ): Promise<InternalBusinessUser | null> {
    const user = await this.userRepository.getMongoBusinessUser(userId)
    return user && (await this.getAugmentedUser<InternalBusinessUser>(user))
  }

  public async getConsumerUser(
    userId: string
  ): Promise<InternalConsumerUser | null> {
    const user = await this.userRepository.getMongoConsumerUser(userId)
    return user && (await this.getAugmentedUser<InternalConsumerUser>(user))
  }

  private async getUpdatedFiles(files: FileInfo[] | undefined) {
    return await Promise.all(
      (files ?? []).map(async (file) => ({
        ...file,
        downloadLink: await this.getDownloadLink(file),
      }))
    )
  }

  private async getAugmentedUser<
    T extends InternalConsumerUser | InternalBusinessUser
  >(user: InternalConsumerUser | InternalBusinessUser) {
    const commentsWithUrl = await Promise.all(
      (user.comments ?? []).map(async (comment) => ({
        ...comment,
        files: await this.getUpdatedFiles(comment.files),
      }))
    )
    return { ...user, comments: commentsWithUrl } as T
  }

  public async updateConsumerUser(
    userId: string,
    updateRequest: UserUpdateRequest
  ): Promise<Comment> {
    const user = await this.userRepository.getConsumerUser(userId)
    if (!user) {
      throw new NotFound('User not found')
    }
    const updatedUser: User = {
      ...(mergeObjects(user, omit(updateRequest, ['comment'])) as User),
      transactionLimits: updateRequest.transactionLimits
        ? {
            ...user.transactionLimits,
            paymentMethodLimits:
              updateRequest.transactionLimits.paymentMethodLimits,
          }
        : undefined,
    }
    await this.userRepository.saveConsumerUser(updatedUser)
    await this.userEventRepository.saveUserEvent(
      {
        timestamp: Date.now(),
        userId,
        reason: updateRequest.userStateDetails?.reason,
        updatedConsumerUserAttributes: updateRequest,
      },
      'CONSUMER'
    )

    return await this.userUpdateComment(updateRequest, userId)
  }

  public async updateBusinessUser(
    userId: string,
    updateRequest: UserUpdateRequest
  ): Promise<Comment> {
    const user = await this.userRepository.getBusinessUser(userId)
    if (!user) {
      throw new NotFound('User not found')
    }
    const updatedUser: Business = {
      ...(mergeObjects(user, omit(updateRequest, ['comment'])) as Business),
      transactionLimits: updateRequest.transactionLimits
        ? {
            ...user.transactionLimits,
            paymentMethodLimits:
              updateRequest.transactionLimits.paymentMethodLimits,
          }
        : undefined,
    }
    await this.userRepository.saveBusinessUser(updatedUser)
    // TODO: FDT-45236. Save business user event
    await this.userEventRepository.saveUserEvent(
      {
        timestamp: Date.now(),
        userId,
        reason: updateRequest.userStateDetails?.reason,
        updatedBusinessUserAttributes: updateRequest,
      },
      'BUSINESS'
    )
    return await this.userUpdateComment(updateRequest, userId)
  }

  public async userUpdateComment(
    updateRequest: UserUpdateRequest,
    userId: string
  ) {
    const { id: userCommentId } = getContext()?.user as Account
    const userComment: Comment = {
      ...updateRequest.comment!,
      userId: userCommentId,
    }
    return await this.saveUserComment(userId, userComment)
  }

  private async getDownloadLink(file: FileInfo): Promise<string> {
    const getObjectCommand = new GetObjectCommand({
      Bucket: this.documentBucketName,
      Key: file.s3Key,
    })

    return await getSignedUrl(this.s3, getObjectCommand, {
      expiresIn: 3600,
    })
  }

  public async getUniques(params: {
    field: UsersUniquesField
    filter?: string
  }): Promise<string[]> {
    return await this.userRepository.getUniques(params)
  }
  public async saveUserComment(userId: string, comment: Comment) {
    for (const file of comment.files || []) {
      const copyObjectCommand = new CopyObjectCommand({
        CopySource: `${this.tmpBucketName}/${file.s3Key}`,
        Bucket: this.documentBucketName,
        Key: file.s3Key,
      })

      await this.s3.send(copyObjectCommand)
    }

    const files = (comment.files || []).map((file) => ({
      ...file,
      bucket: this.documentBucketName,
    }))
    const savedComment = await this.userRepository.saveUserComment(userId, {
      ...comment,
      files,
    })

    return {
      ...savedComment,
      files: await this.getUpdatedFiles(savedComment.files),
    }
  }
  public async deleteUserComment(userId: string, commentId: string) {
    const user = await this.userRepository.getUserById(userId)
    if (!user) {
      throw new createError.NotFound(`User ${userId} not found`)
    }

    const comment = user?.comments?.find((comment) => comment.id === commentId)
    if (!comment) {
      throw new createError.NotFound(`Comment ${commentId} not found`)
    }

    if (comment.files && comment.files.length > 0) {
      await this.s3.deleteObjects({
        Bucket: this.documentBucketName,
        Delete: { Objects: comment.files.map((file) => ({ Key: file.s3Key })) },
      })
    }
    await this.userRepository.deleteUserComment(userId, commentId)
  }
}
