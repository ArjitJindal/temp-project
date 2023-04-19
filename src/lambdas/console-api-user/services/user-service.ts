import * as createError from 'http-errors'
import { MongoClient } from 'mongodb'
import { NotFound } from 'http-errors'
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb'
import _ from 'lodash'
import {
  APIGatewayEventLambdaAuthorizerContext,
  APIGatewayProxyWithLambdaAuthorizerEvent,
} from 'aws-lambda'
import * as AWS from 'aws-sdk'
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
import { getMongoDbClient } from '@/utils/mongoDBUtils'
import { getDynamoDbClientByEvent } from '@/utils/dynamodb'
import { UserViewConfig } from '@/lambdas/console-api-user/app'

export class UserService {
  userRepository: UserRepository
  userEventRepository: UserEventRepository
  s3: AWS.S3
  documentBucketName: string
  tmpBucketName: string

  constructor(
    tenantId: string,
    connections: {
      dynamoDb?: DynamoDBDocumentClient
      mongoDb?: MongoClient
    },
    s3: AWS.S3,
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
      APIGatewayEventLambdaAuthorizerContext<AWS.STS.Credentials>
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
    return {
      ...result,
      data: result.data.map((user) =>
        this.getAugmentedUser<InternalBusinessUser>(user)
      ),
    }
  }

  public async getConsumerUsers(
    params: DefaultApiGetConsumerUsersListRequest
  ): Promise<ConsumerUsersListResponse> {
    const result = await this.userRepository.getMongoConsumerUsers(params)
    return {
      ...result,
      data: result.data.map((user) =>
        this.getAugmentedUser<InternalConsumerUser>(user)
      ),
    }
  }

  public async getUsers(
    params: DefaultApiGetAllUsersListRequest
  ): Promise<AllUsersListResponse> {
    const result = await this.userRepository.getMongoAllUsers(params)
    return {
      ...result,
      data: result.data.map((user) =>
        this.getAugmentedUser<InternalUser>(user)
      ),
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
    return user && this.getAugmentedUser<InternalBusinessUser>(user)
  }

  public async getConsumerUser(
    userId: string
  ): Promise<InternalConsumerUser | null> {
    const user = await this.userRepository.getMongoConsumerUser(userId)
    return user && this.getAugmentedUser<InternalConsumerUser>(user)
  }

  private getAugmentedUser<
    T extends InternalConsumerUser | InternalBusinessUser
  >(user: InternalConsumerUser | InternalBusinessUser) {
    const commentsWithUrl = user.comments?.map((comment) => ({
      ...comment,
      files: comment.files?.map((file) => ({
        ...file,
        downloadLink: this.getDownloadLink(file),
      })),
    }))
    return { ...user, comments: commentsWithUrl } as T
  }

  public async updateConsumerUser(
    userId: string,
    updateRequest: UserUpdateRequest
  ) {
    const user = await this.userRepository.getConsumerUser(userId)
    if (!user) {
      throw new NotFound('User not found')
    }
    const updatedUser: User = {
      ..._.merge(user, updateRequest),
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
    return 'OK'
  }

  public async updateBusinessUser(
    userId: string,
    updateRequest: UserUpdateRequest
  ) {
    const user = await this.userRepository.getBusinessUser(userId)
    if (!user) {
      throw new NotFound('User not found')
    }
    const updatedUser: Business = {
      ..._.merge(user, updateRequest),
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
    return 'OK'
  }

  private getDownloadLink(file: FileInfo): string {
    return this.s3.getSignedUrl('getObject', {
      Bucket: this.documentBucketName,
      Key: file.s3Key,
      Expires: 3600,
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
      await this.s3
        .copyObject({
          CopySource: `${this.tmpBucketName}/${file.s3Key}`,
          Bucket: this.documentBucketName,
          Key: file.s3Key,
        })
        .promise()
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
      files: savedComment.files?.map((file) => ({
        ...file,
        downloadLink: this.getDownloadLink(file),
      })),
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
