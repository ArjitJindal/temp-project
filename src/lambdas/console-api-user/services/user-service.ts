import * as createError from 'http-errors'
import { MongoClient } from 'mongodb'
import { NotFound } from 'http-errors'
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb'
import _ from 'lodash'
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
import { UsersUniquesResponse } from '@/@types/openapi-internal/UsersUniquesResponse'
import { Business } from '@/@types/openapi-public/Business'

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
    return {
      ...user,
      files: user.files?.map((file) => ({
        ...file,
        downloadLink: this.getDownloadLink(file),
      })),
    } as T
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

  public async saveUserFile(userId: string, file: FileInfo): Promise<FileInfo> {
    // Copy the files from tmp bucket to document bucket
    await this.s3
      .copyObject({
        CopySource: `${this.tmpBucketName}/${file.s3Key}`,
        Bucket: this.documentBucketName,
        Key: file.s3Key,
      })
      .promise()
    return this.userRepository.saveMongoUserFile(userId, {
      ...file,
      bucket: this.documentBucketName,
    })
  }

  public async deleteUserFile(userId: string, fileId: string) {
    const user = await this.userRepository.getMongoUser(userId)
    if (!user) {
      throw new createError.NotFound(`User ${userId} not found`)
    }

    await this.s3.deleteObjects({
      Bucket: this.documentBucketName,
      Delete: { Objects: [{ Key: fileId }] },
    })
    await this.userRepository.deleteMongoUserFile(userId, fileId)
  }

  private getDownloadLink(file: FileInfo): string {
    return this.s3.getSignedUrl('getObject', {
      Bucket: this.documentBucketName,
      Key: file.s3Key,
      Expires: 3600,
    })
  }
  public async getUniques(): Promise<UsersUniquesResponse> {
    return this.userRepository.getUniques()
  }
}
