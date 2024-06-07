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
import { isEmpty, isEqual, pick } from 'lodash'
import { diff } from 'deep-object-diff'
import { DEFAULT_RISK_LEVEL } from '../risk-scoring/utils'
import { isBusinessUser } from '../rules-engine/utils/user-rule-utils'
import { FLAGRIGHT_SYSTEM_USER } from '../alerts/repository'
import { ThinWebhookDeliveryTask, sendWebhookTasks } from '../webhook/utils'
import {
  DYNAMO_ONLY_USER_ATTRIBUTES,
  getExternalComment,
} from './utils/user-utils'
import { User } from '@/@types/openapi-public/User'
import { FileInfo } from '@/@types/openapi-internal/FileInfo'
import { UserRepository } from '@/services/users/repositories/user-repository'
import {
  DefaultApiGetAllUsersListRequest,
  DefaultApiGetBusinessUsersListRequest,
  DefaultApiGetConsumerUsersListRequest,
  DefaultApiGetEventsListRequest,
  DefaultApiGetRuleInstancesTransactionUsersHitRequest,
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
import { getContext, hasFeature } from '@/core/utils/context'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import { getDynamoDbClientByEvent } from '@/utils/dynamodb'
import { UserViewConfig } from '@/lambdas/console-api-user/app'
import { traceable } from '@/core/xray'
import { TransactionWithRulesResult } from '@/@types/openapi-internal/TransactionWithRulesResult'
import { RuleInstance } from '@/@types/openapi-internal/RuleInstance'
import { KYCStatus } from '@/@types/openapi-internal/KYCStatus'
import { UserState } from '@/@types/openapi-internal/UserState'
import { UserStateDetailsInternal } from '@/@types/openapi-internal/UserStateDetailsInternal'
import { KYCStatusDetailsInternal } from '@/@types/openapi-internal/KYCStatusDetailsInternal'
import { TriggersOnHit } from '@/@types/openapi-internal/TriggersOnHit'
import { UserAuditLogService } from '@/lambdas/console-api-user/services/user-audit-log-service'
import { UserStateDetails } from '@/@types/openapi-internal/UserStateDetails'
import { KYCStatusDetails } from '@/@types/openapi-internal/KYCStatusDetails'
import { CommentRequest } from '@/@types/openapi-public-management/CommentRequest'

const KYC_STATUS_DETAILS_PRIORITY: Record<KYCStatus, number> = {
  MANUAL_REVIEW: 0,
  FAILED: 1,
  CANCELLED: 2,
  IN_PROGRESS: 3,
  EXPIRED: 4,
  SUCCESSFUL: 5,
  EDD_IN_PROGRESS: 6,
  NOT_STARTED: 7,
  NEW: 8,
}

const USER_STATE_DETAILS_PRIORITY: Record<UserState, number> = {
  UNACCEPTABLE: 0,
  BLOCKED: 1,
  TERMINATED: 2,
  SUSPENDED: 3,
  DORMANT: 4,
  ACTIVE: 5,
  CREATED: 6,
}

export const API_USER = 'API'

@traceable
export class UserService {
  userRepository: UserRepository
  userEventRepository: UserEventRepository
  s3: S3
  documentBucketName: string
  tmpBucketName: string
  mongoDb: MongoClient
  dynamoDb: DynamoDBDocumentClient

  constructor(
    tenantId: string,
    connections: {
      dynamoDb?: DynamoDBDocumentClient
      mongoDb?: MongoClient
    },
    s3?: S3,
    tmpBucketName?: string,
    documentBucketName?: string
  ) {
    this.userRepository = new UserRepository(tenantId, {
      mongoDb: connections.mongoDb,
      dynamoDb: connections.dynamoDb,
    })
    this.userEventRepository = new UserEventRepository(tenantId, {
      mongoDb: connections.mongoDb,
      dynamoDb: connections.dynamoDb,
    })
    this.s3 = s3 as S3
    this.tmpBucketName = tmpBucketName as string
    this.documentBucketName = documentBucketName as string
    this.mongoDb = connections.mongoDb as MongoClient
    this.dynamoDb = connections.dynamoDb as DynamoDBDocumentClient
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
    const result = await this.userRepository.getMongoUsersCursorsPaginate(
      params,
      'BUSINESS'
    )
    const items = await Promise.all(
      result.items.map(
        async (user) => await this.getAugmentedUser<InternalBusinessUser>(user)
      )
    )
    return {
      ...result,
      items,
    }
  }

  private getTriggersOnHit(
    ruleInstance: RuleInstance,
    user: InternalUser | null,
    direction: 'ORIGIN' | 'DESTINATION',
    isPulseEnabled: boolean
  ): TriggersOnHit | undefined {
    const triggersOnHit =
      isPulseEnabled && !isEmpty(ruleInstance.riskLevelsTriggersOnHit)
        ? ruleInstance.riskLevelsTriggersOnHit[
            user?.riskLevel ?? DEFAULT_RISK_LEVEL
          ]
        : ruleInstance.triggersOnHit

    if (!triggersOnHit?.usersToCheck) {
      return
    }

    if (!['ALL', direction].includes(triggersOnHit.usersToCheck)) {
      return
    }

    return triggersOnHit
  }

  private getUserEventData(
    user: User | Business,
    userStateDetails: UserStateDetailsInternal | undefined,
    kycStatusDetails: KYCStatusDetailsInternal | undefined
  ): UserUpdateRequest {
    const newKycStatus = kycStatusDetails?.status
    const oldKycStatus = user?.kycStatusDetails?.status
    const oldUserState = user?.userStateDetails?.state
    const newUserState = userStateDetails?.state

    const updateableData: UserUpdateRequest = {}

    if (newKycStatus && newKycStatus !== oldKycStatus) {
      updateableData.kycStatusDetails = {
        status: newKycStatus,
        reason: kycStatusDetails?.reason ?? '',
        description: kycStatusDetails?.description ?? '',
      }
    }

    if (newUserState && newUserState !== oldUserState) {
      updateableData.userStateDetails = {
        state: newUserState,
        reason: userStateDetails?.reason ?? '',
        description: userStateDetails?.description ?? '',
      }
    }

    return updateableData
  }

  private processUserAndKycDetails(
    triggersOnHit: TriggersOnHit,
    userStateDetails: UserStateDetailsInternal | undefined,
    kycStatusDetails: KYCStatusDetailsInternal | undefined,
    userStateRID: RuleInstance | undefined,
    kycStatusRID: RuleInstance | undefined,
    ruleInstance: RuleInstance
  ): [
    UserStateDetailsInternal | undefined,
    KYCStatusDetailsInternal | undefined,
    RuleInstance | undefined,
    RuleInstance | undefined
  ] {
    const newUserState = this.getUserStateDetails(
      triggersOnHit,
      userStateDetails
    )

    if (!isEqual(newUserState, userStateDetails)) {
      userStateRID = ruleInstance
    }

    userStateDetails = newUserState

    const newKycStatus = this.getKycStatusDetails(
      triggersOnHit,
      kycStatusDetails
    )

    if (!isEqual(newKycStatus, kycStatusDetails)) {
      kycStatusRID = ruleInstance
    }

    kycStatusDetails = newKycStatus

    return [userStateDetails, kycStatusDetails, userStateRID, kycStatusRID]
  }

  private async saveUserEvents(
    user: User | Business | null,
    userStateDetails: UserStateDetailsInternal | undefined,
    kycStatusDetails: KYCStatusDetailsInternal | undefined,
    userRID?: RuleInstance,
    kycStatusRID?: RuleInstance
  ) {
    if (!user) return
    const data = this.getUserEventData(user, userStateDetails, kycStatusDetails)
    if (!isEmpty(data)) {
      await this.updateUser(user, data, {
        bySystem: true,
        kycRuleInstance: kycStatusRID,
        userStateRuleInstance: userRID,
      })
    }
  }

  public async handleTransactionUserStatusUpdateTrigger(
    transaction: TransactionWithRulesResult,
    ruleInstancesHit: RuleInstance[],
    originUser: InternalUser | null,
    destinationUser: InternalUser | null
  ) {
    let originUserStateDetails: UserStateDetailsInternal | undefined
    let destinationUserStateDetails: UserStateDetailsInternal | undefined
    let originKycStatusDetails: KYCStatusDetailsInternal | undefined
    let destinationKycStatusDetails: KYCStatusDetailsInternal | undefined

    const isRiskLevelsEnabled = hasFeature('RISK_LEVELS')

    let originKycStatusRID: RuleInstance | undefined
    let destinationKycStatusRID: RuleInstance | undefined
    let originUserStateRID: RuleInstance | undefined
    let destinationUserStateRID: RuleInstance | undefined

    ruleInstancesHit.forEach((ruleInstance) => {
      const hitRulesDetails = transaction?.hitRules.find(
        (hitRule) => hitRule.ruleInstanceId === ruleInstance.id
      )

      if (!hitRulesDetails) {
        return
      }

      const triggersOnHitOrigin = this.getTriggersOnHit(
        ruleInstance,
        originUser,
        'ORIGIN',
        isRiskLevelsEnabled
      )

      const triggersOnHitDestination = this.getTriggersOnHit(
        ruleInstance,
        destinationUser,
        'DESTINATION',
        isRiskLevelsEnabled
      )

      if (
        triggersOnHitOrigin &&
        hitRulesDetails.ruleHitMeta?.hitDirections?.includes('ORIGIN')
      ) {
        ;[
          originUserStateDetails,
          originKycStatusDetails,
          originUserStateRID,
          originKycStatusRID,
        ] = this.processUserAndKycDetails(
          triggersOnHitOrigin,
          originUserStateDetails,
          originKycStatusDetails,
          originUserStateRID,
          originKycStatusRID,
          ruleInstance
        )
      }

      if (
        triggersOnHitDestination &&
        hitRulesDetails.ruleHitMeta?.hitDirections?.includes('DESTINATION')
      ) {
        ;[
          destinationUserStateDetails,
          destinationKycStatusDetails,
          destinationUserStateRID,
          destinationKycStatusRID,
        ] = this.processUserAndKycDetails(
          triggersOnHitDestination,
          destinationUserStateDetails,
          destinationKycStatusDetails,
          destinationUserStateRID,
          destinationKycStatusRID,
          ruleInstance
        )
      }
    })

    const promises: Promise<void>[] = [
      this.saveUserEvents(
        originUser,
        originUserStateDetails,
        originKycStatusDetails,
        originUserStateRID,
        originKycStatusRID
      ),
      this.saveUserEvents(
        destinationUser,
        destinationUserStateDetails,
        destinationKycStatusDetails,
        destinationUserStateRID,
        destinationKycStatusRID
      ),
    ]

    await Promise.all(promises)
  }

  private getUserStateDetails(
    triggersOnHit: TriggersOnHit,
    userStateDetails: UserStateDetailsInternal | undefined
  ): UserStateDetailsInternal | undefined {
    const triggerUserState = triggersOnHit?.userStateDetails?.state

    if (triggerUserState) {
      if (!userStateDetails || !userStateDetails.state) {
        return (userStateDetails = {
          state: triggerUserState,
          reason: triggersOnHit?.userStateDetails?.reason ?? '',
          description: triggersOnHit?.userStateDetails?.description ?? '',
        })
      } else {
        const currentPriority =
          USER_STATE_DETAILS_PRIORITY[userStateDetails.state]
        const newPriority = USER_STATE_DETAILS_PRIORITY[triggerUserState]

        if (newPriority < currentPriority) {
          return (userStateDetails = {
            state: triggerUserState,
            reason: triggersOnHit?.userStateDetails?.reason ?? '',
            description: triggersOnHit?.userStateDetails?.description ?? '',
          })
        }
      }
    }

    return userStateDetails
  }

  private getKycStatusDetails(
    triggersOnHit: TriggersOnHit,
    kycStatusDetails: KYCStatusDetailsInternal | undefined
  ): KYCStatusDetailsInternal | undefined {
    const triggerKycStatus = triggersOnHit?.kycStatusDetails?.status

    if (triggerKycStatus) {
      if (!kycStatusDetails || !kycStatusDetails.status) {
        return (kycStatusDetails = {
          status: triggerKycStatus,
          reason: triggersOnHit?.kycStatusDetails?.reason ?? '',
          description: triggersOnHit?.kycStatusDetails?.description ?? '',
        })
      } else {
        const currentPriority =
          KYC_STATUS_DETAILS_PRIORITY[kycStatusDetails.status]
        const newPriority = KYC_STATUS_DETAILS_PRIORITY[triggerKycStatus]

        if (newPriority < currentPriority) {
          return (kycStatusDetails = {
            status: triggerKycStatus,
            reason: triggersOnHit?.kycStatusDetails?.reason ?? '',
            description: triggersOnHit?.kycStatusDetails?.description ?? '',
          })
        }
      }
    }

    return kycStatusDetails
  }

  private async sendUserAndKycWebhook(
    oldUser: User | Business,
    newUser: User | Business,
    isManual: boolean
  ): Promise<void> {
    const webhookTasks: ThinWebhookDeliveryTask<
      UserStateDetails | KYCStatusDetails
    >[] = []
    if (
      newUser.userStateDetails &&
      diff(oldUser.userStateDetails ?? {}, newUser.userStateDetails ?? {})
    ) {
      const webhookUserStateDetails: UserStateDetails = {
        ...newUser.userStateDetails,
        userId: newUser.userId,
      }

      webhookTasks.push({
        event: 'USER_STATE_UPDATED',
        payload: webhookUserStateDetails,
        triggeredBy: isManual ? 'MANUAL' : 'SYSTEM',
      })
    }

    if (
      newUser.kycStatusDetails &&
      diff(oldUser.kycStatusDetails ?? {}, newUser.kycStatusDetails ?? {})
    ) {
      const webhookKYCStatusDetails: KYCStatusDetails = {
        ...newUser.kycStatusDetails,
        userId: newUser.userId,
      }

      webhookTasks.push({
        event: 'KYC_STATUS_UPDATED',
        payload: webhookKYCStatusDetails,
        triggeredBy: isManual ? 'MANUAL' : 'SYSTEM',
      })
    }

    if (webhookTasks.length > 0) {
      await sendWebhookTasks(this.userRepository.tenantId, webhookTasks)
    }
  }

  public getKycAndUserUpdateComment(data: {
    kycRuleInstance?: RuleInstance
    userStateRuleInstance?: RuleInstance
    kycStatusDetails?: KYCStatusDetailsInternal
    userStateDetails?: UserStateDetailsInternal
    caseId?: string
    comment?: string
  }): string | undefined {
    const {
      kycRuleInstance,
      userStateRuleInstance,
      kycStatusDetails,
      userStateDetails,
      caseId,
    } = data

    const kycStatus = kycStatusDetails?.status
    const userState = userStateDetails?.state

    let reasonsText = [
      userStateDetails?.reason &&
        `User state update reason: ${userStateDetails.reason}`,
      userStateDetails?.description &&
        `User state update description: ${userStateDetails.description}`,
      kycStatusDetails?.reason &&
        `KYC status update reason: ${kycStatusDetails.reason}`,
      kycStatusDetails?.description &&
        `KYC status update description: ${kycStatusDetails.description}`,
      data.comment && `Comment: ${data.comment}`,
    ]
      .filter(Boolean)
      .join('\n')

    const caseIdText = caseId ? ` by case ${caseId}` : ``

    if (reasonsText) {
      reasonsText = '\n' + reasonsText
    }

    const kycRuleText = kycRuleInstance
      ? `Rule ${kycRuleInstance.ruleId}(${kycRuleInstance.id}) is hit and KYC status updated to ${kycStatus}`
      : ''

    const userStateRuleText = userStateRuleInstance
      ? `Rule ${userStateRuleInstance.ruleId}(${userStateRuleInstance.id}) is hit and User status updated to ${userState}`
      : ''

    if (kycRuleInstance && userStateRuleInstance && kycStatus && userState) {
      return `${kycRuleText} and ${userStateRuleText}${reasonsText}`
    }

    if (kycRuleInstance && kycStatus) {
      return `${kycRuleText}${reasonsText}`
    }

    if (userStateRuleInstance && userState) {
      return `${userStateRuleText}${reasonsText}`
    }

    if (!kycRuleInstance && !userStateRuleInstance) {
      if (kycStatus && userState) {
        return `KYC status changed to ${kycStatus} and user status changed to ${userState}${caseIdText}${reasonsText}`
      } else if (kycStatus) {
        return `KYC status changed to ${kycStatus}${caseIdText}${reasonsText}`
      } else if (userState) {
        return `User status changed to ${userState}${caseIdText}${reasonsText}`
      }
    }

    return
  }

  public async getConsumerUsers(
    params: DefaultApiGetConsumerUsersListRequest
  ): Promise<ConsumerUsersListResponse> {
    const result = await this.userRepository.getMongoUsersCursorsPaginate(
      params,
      'CONSUMER'
    )
    const items = await Promise.all(
      result.items.map(
        async (user) => await this.getAugmentedUser<InternalConsumerUser>(user)
      )
    )
    return {
      ...result,
      items,
    }
  }

  public async getUsers(
    params: DefaultApiGetAllUsersListRequest
  ): Promise<AllUsersListResponse> {
    return await this.augmentUsers(
      await this.userRepository.getMongoUsersCursorsPaginate(params)
    )
  }

  private async augmentUsers(
    data: AllUsersListResponse
  ): Promise<AllUsersListResponse> {
    const items = await Promise.all(
      data.items.map(async (user) => {
        return await this.getAugmentedUser<InternalUser>(user)
      })
    )

    return { ...data, items }
  }

  public async getRuleInstancesTransactionUsersHit(
    ruleInstanceId: string,
    params: DefaultApiGetRuleInstancesTransactionUsersHitRequest
  ): Promise<AllUsersListResponse> {
    return await this.augmentUsers(
      await this.userRepository.getRuleInstancesTransactionUsersHit(
        ruleInstanceId,
        params
      )
    )
  }

  public async updateMointoringStatus(userId: string, isEnabled: boolean) {
    const user = await this.userRepository.getUserById(userId)

    if (!isBusinessUser(user as Business | User)) {
      throw new createError.BadRequest(
        `Cannot enable monitoring for non-business user ${userId}`
      )
    }

    await this.userRepository.updateMonitoringStatus(userId, isEnabled)
  }

  public async getTotalEnabledOngoingMonitoringUsers(): Promise<number> {
    return await this.userRepository.getTotalEnabledOngoingMonitoringUsers()
  }

  public async getUser(userId: string): Promise<InternalUser> {
    const usersListResponse = await this.getUsers({
      filterId: userId,
      beforeTimestamp: Number.MAX_SAFE_INTEGER,
    })
    if (usersListResponse.items && usersListResponse.items.length > 0) {
      return usersListResponse.items[0]
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

  public async updateUser(
    user: User | Business,
    updateRequest: UserUpdateRequest,
    options?: {
      bySystem?: boolean
      kycRuleInstance?: RuleInstance
      userStateRuleInstance?: RuleInstance
      caseId?: string
    }
  ): Promise<Comment> {
    if (!user) {
      throw new NotFound('User not found')
    }

    const isBusiness = isBusinessUser(user)

    const updatedUser: User | Business = {
      ...user,
      ...this.getUserEventData(
        user,
        updateRequest.userStateDetails,
        updateRequest.kycStatusDetails
      ),
      transactionLimits: updateRequest.transactionLimits
        ? {
            ...user.transactionLimits,
            paymentMethodLimits:
              updateRequest.transactionLimits.paymentMethodLimits,
          }
        : undefined,
    }

    const userToUpdate = pick(updatedUser, DYNAMO_ONLY_USER_ATTRIBUTES)

    if (isBusiness) {
      await this.userRepository.saveBusinessUser(userToUpdate as Business)
    } else {
      await this.userRepository.saveConsumerUser(userToUpdate as User)
    }

    await this.userEventRepository.saveUserEvent(
      {
        timestamp: Date.now(),
        userId: user.userId,
        reason: updateRequest.userStateDetails?.reason,
        updatedConsumerUserAttributes: updateRequest,
      },
      isBusiness ? 'BUSINESS' : 'CONSUMER'
    )

    const commentBody = this.getKycAndUserUpdateComment({
      caseId: options?.caseId,
      kycRuleInstance: options?.kycRuleInstance,
      kycStatusDetails: updateRequest.kycStatusDetails,
      userStateDetails: updateRequest.userStateDetails,
      comment: updateRequest.comment?.body,
      userStateRuleInstance: options?.userStateRuleInstance,
    })

    const userAuditLogService = new UserAuditLogService(
      this.userRepository.tenantId
    )

    const [savedComment] = await Promise.all([
      this.userRepository.saveUserComment(user.userId, {
        body: commentBody ?? '',
        createdAt: Date.now(),
        userId: options?.bySystem
          ? FLAGRIGHT_SYSTEM_USER
          : (getContext()?.user?.id as string),
        files: updateRequest.comment?.files ?? [],
        updatedAt: Date.now(),
      }),
      userAuditLogService.handleAuditLogForUserUpdate(
        updateRequest,
        user.userId
      ),
      this.sendUserAndKycWebhook(user, updatedUser, options?.bySystem ?? false),
    ])
    return savedComment
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

  public async saveUserCommentExternal(
    userId: string,
    comment: CommentRequest
  ) {
    const savedComment = await this.saveUserComment(userId, {
      ...comment,
      id: comment.commentId,
      createdAt: comment.createdTimestamp ?? Date.now(),
      updatedAt: comment.createdTimestamp ?? Date.now(),
      userId: API_USER,
    })
    return getExternalComment(savedComment)
  }

  public async getUserCommentsExternal(userId: string) {
    const user = await this.userRepository.getUserById(userId)
    if (!user) {
      throw new createError.NotFound(`User ${userId} not found`)
    }

    const comments = await Promise.all(
      (user.comments || []).map(async (comment) => ({
        ...comment,
        files: await this.getUpdatedFiles(comment.files),
      }))
    )
    return comments.map((comment) => {
      return getExternalComment(comment)
    })
  }

  public async getUserComment(userId: string, commentId: string) {
    const user = await this.userRepository.getUserById(userId)
    if (!user) {
      throw new createError.NotFound(`User ${userId} not found`)
    }

    const comment = user?.comments?.find((comment) => comment.id === commentId)
    if (!comment) {
      throw new createError.NotFound(`Comment ${commentId} not found`)
    }

    const commentUpdated = {
      ...comment,
      files: await this.getUpdatedFiles(comment.files),
    }
    return getExternalComment(commentUpdated)
  }

  public async saveUserCommentReply(
    userId: string,
    commentId: string,
    reply: Comment
  ) {
    const user = await this.userRepository.getUserById(userId)

    if (!user) {
      throw new createError.NotFound(`User ${userId} not found`)
    }

    const comment = user?.comments?.find((comment) => comment.id === commentId)

    if (!comment) {
      throw new createError.NotFound(`Comment ${commentId} not found`)
    }

    const savedReply = await this.userRepository.saveUserComment(userId, {
      ...reply,
      parentId: commentId,
    })

    return {
      ...savedReply,
      files: await this.getUpdatedFiles(savedReply.files),
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

  public async getEventsList(params: DefaultApiGetEventsListRequest) {
    const userEventsRepository = new UserEventRepository(
      this.userRepository.tenantId,
      { mongoDb: this.mongoDb, dynamoDb: this.dynamoDb }
    )
    const userEvents = await userEventsRepository.getMongoUserEvents(params)
    const count = await userEventsRepository.getUserEventsCount(params.userId)

    return {
      items: userEvents,
      total: count,
    }
  }
}
