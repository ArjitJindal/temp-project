import * as createError from 'http-errors'
import { FileInfo } from '@/@types/openapi-internal/FileInfo'
import { UserRepository } from '@/services/users/repositories/user-repository'
import {
  DefaultApiGetBusinessUsersListRequest,
  DefaultApiGetConsumerUsersListRequest,
} from '@/@types/openapi-internal/RequestParameters'
import { BusinessUsersListResponse } from '@/@types/openapi-internal/BusinessUsersListResponse'
import { ConsumerUsersListResponse } from '@/@types/openapi-internal/ConsumerUsersListResponse'
import { InternalBusinessUser } from '@/@types/openapi-internal/InternalBusinessUser'
import { InternalConsumerUser } from '@/@types/openapi-internal/InternalConsumerUser'

export class UserService {
  userRepository: UserRepository
  s3: AWS.S3
  documentBucketName: string
  tmpBucketName: string

  constructor(
    userRepository: UserRepository,
    s3: AWS.S3,
    tmpBucketName: string,
    documentBucketName: string
  ) {
    this.userRepository = userRepository
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
}
