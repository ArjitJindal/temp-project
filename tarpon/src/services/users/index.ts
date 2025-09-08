import * as createError from 'http-errors'
import { NotFound } from 'http-errors'
import { MongoClient } from 'mongodb'
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb'
import { GetObjectCommand, S3 } from '@aws-sdk/client-s3'
import {
  APIGatewayEventLambdaAuthorizerContext,
  APIGatewayProxyWithLambdaAuthorizerEvent,
  Credentials as LambdaCredentials,
} from 'aws-lambda'
import { Credentials } from '@aws-sdk/client-sts'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { isEmpty, isEqual, omit, pick, uniq, uniqBy } from 'lodash'
import { diff } from 'deep-object-diff'
import { ClickHouseClient } from '@clickhouse/client'
import { UserUpdateApprovalWorkflowMachine } from '@flagright/lib/classes/workflow-machine'
import { UserUpdateApprovalWorkflow } from '@flagright/lib/@types/workflow'
import { DEFAULT_RISK_LEVEL } from '../risk-scoring/utils'
import { isBusinessUser } from '../rules-engine/utils/user-rule-utils'
import { sendWebhookTasks, ThinWebhookDeliveryTask } from '../webhook/utils'
import { sendBatchJobCommand } from '../batch-jobs/batch-job'
import { UserManagementService } from '../rules-engine/user-rules-engine-service'
import { LogicEvaluator } from '../logic-evaluator/engine'
import { RiskScoringV8Service } from '../risk-scoring/risk-scoring-v8-service'
import {
  handleInternalTagUpdateForPNB,
  PNB_INTERNAL_RULES,
} from '../rules-engine/pnb-custom-logic'
import { mergeUserTags } from '../rules-engine/utils'
import { LinkerService } from '../linker'
import { UserClickhouseRepository } from './repositories/user-clickhouse-repository'
import { DYNAMO_ONLY_USER_ATTRIBUTES } from './utils/user-utils'
import { FLAGRIGHT_SYSTEM_USER } from '@/utils/user'
import { User } from '@/@types/openapi-public/User'
import { FileInfo } from '@/@types/openapi-internal/FileInfo'
import { UserRepository } from '@/services/users/repositories/user-repository'
import {
  DefaultApiGetAllUsersListRequest,
  DefaultApiGetBusinessUsersListRequest,
  DefaultApiGetConsumerUsersListRequest,
  DefaultApiGetEventsListRequest,
  DefaultApiGetRuleInstancesTransactionUsersHitRequest,
  DefaultApiGetUserEntityChildUsersRequest,
} from '@/@types/openapi-internal/RequestParameters'
import { InternalBusinessUser } from '@/@types/openapi-internal/InternalBusinessUser'
import { InternalConsumerUser } from '@/@types/openapi-internal/InternalConsumerUser'
import { UserUpdateRequest } from '@/@types/openapi-internal/UserUpdateRequest'
import { UserEventRepository } from '@/services/rules-engine/repositories/user-event-repository'
import { InternalUser } from '@/@types/openapi-internal/InternalUser'
import { UsersUniquesField } from '@/@types/openapi-internal/UsersUniquesField'
import { Comment } from '@/@types/openapi-internal/Comment'
import { Business } from '@/@types/openapi-public/Business'
import { getS3ClientByEvent } from '@/utils/s3'
import { hasFeature, tenantSettings } from '@/core/utils/context'
import { getContext } from '@/core/utils/context-storage'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import { getDynamoDbClientByEvent } from '@/utils/dynamodb'
import { UserViewConfig } from '@/lambdas/console-api-user/app'
import { traceable } from '@/core/xray'
import { RuleInstance } from '@/@types/openapi-internal/RuleInstance'
import { KYCStatus } from '@/@types/openapi-internal/KYCStatus'
import { UserState } from '@/@types/openapi-internal/UserState'
import { UserStateDetailsInternal } from '@/@types/openapi-internal/UserStateDetailsInternal'
import { KYCStatusDetailsInternal } from '@/@types/openapi-internal/KYCStatusDetailsInternal'
import { TriggersOnHit } from '@/@types/openapi-internal/TriggersOnHit'
import { UserAuditLogService } from '@/lambdas/console-api-user/services/user-audit-log-service'
import { CommentRequest } from '@/@types/openapi-public-management/CommentRequest'
import { getExternalComment } from '@/utils/external-transformer'
import { getCredentialsFromEvent } from '@/utils/credentials'
import { CaseRepository } from '@/services/cases/repository'
import {
  formatConsumerName,
  getParsedCommentBody,
  getUserName,
} from '@/utils/helpers'
import { BusinessUsersOffsetPaginateListResponse } from '@/@types/openapi-internal/BusinessUsersOffsetPaginateListResponse'
import { ConsumerUsersOffsetPaginateListResponse } from '@/@types/openapi-internal/ConsumerUsersOffsetPaginateListResponse'
import { AllUsersOffsetPaginateListResponse } from '@/@types/openapi-internal/AllUsersOffsetPaginateListResponse'
import {
  getClickhouseClient,
  isClickhouseEnabled,
} from '@/utils/clickhouse/utils'
import { DefaultApiGetUsersSearchRequest } from '@/@types/openapi-public-management/RequestParameters'
import { UsersSearchResponse } from '@/@types/openapi-public-management/UsersSearchResponse'
import { pickKnownEntityFields } from '@/utils/object'
import { PEPStatus } from '@/@types/openapi-internal/PEPStatus'
import { S3Service } from '@/services/aws/s3-service'
import { UserTag } from '@/@types/openapi-internal/UserTag'
import { UserTagsUpdate } from '@/@types/openapi-public/UserTagsUpdate'
import { HitRulesDetails } from '@/@types/openapi-internal/HitRulesDetails'
import { ListService } from '@/services/list'
import { PersonAttachment } from '@/@types/openapi-internal/PersonAttachment'
import { AllUsersTableItem } from '@/@types/openapi-internal/AllUsersTableItem'
import { AllUsersPreviewOffsetPaginateListResponse } from '@/@types/openapi-internal/AllUsersPreviewOffsetPaginateListResponse'
import { UserType } from '@/@types/openapi-internal/UserType'
import { RiskLevel } from '@/@types/openapi-internal/RiskLevel'
import { ConsumerUserTableItem } from '@/@types/openapi-internal/ConsumerUserTableItem'
import { CountryCode } from '@/@types/openapi-public/CountryCode'
import { BusinessUserTableItem } from '@/@types/openapi-internal/BusinessUserTableItem'
import { Amount } from '@/@types/openapi-public/Amount'
import { UserRegistrationStatus } from '@/@types/openapi-internal/UserRegistrationStatus'
import { ConsumerName } from '@/@types/openapi-public/ConsumerName'
import { auditLog, AuditLogReturnData } from '@/utils/audit-log'
import { ListItem } from '@/@types/openapi-internal/ListItem'
import { UserFlatFileUploadRequest } from '@/@types/openapi-internal/UserFlatFileUploadRequest'
import { WebhookUserStateDetails } from '@/@types/openapi-public/WebhookUserStateDetails'
import { WebhookKYCStatusDetails } from '@/@types/openapi-public/WebhookKYCStatusDetails'
import { UserApproval } from '@/@types/openapi-internal/UserApproval'
import { UserProposedChange } from '@/@types/openapi-internal/UserProposedChange'
import { UserApprovalRequest } from '@/@types/openapi-internal/UserApprovalRequest'
import { TenantSettings } from '@/@types/openapi-internal/TenantSettings'
import { WorkflowService } from '@/services/workflow'
import { shouldSkipFirstApprovalStep } from '@/services/workflow/approval-utils'
import { UserWithRulesResult } from '@/@types/openapi-internal/UserWithRulesResult'
import { BusinessWithRulesResult } from '@/@types/openapi-public/BusinessWithRulesResult'
import { RiskService } from '@/services/risk'

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

function internalUserToExternalUser(
  user: InternalBusinessUser | InternalConsumerUser
): User | Business {
  if (isBusinessUser(user)) {
    return pickKnownEntityFields(user, Business)
  }
  return pickKnownEntityFields(user, User)
}

type UpdatableUserDetails = Pick<
  UserUpdateRequest,
  'kycStatusDetails' | 'userStateDetails' | 'pepStatus' | 'tags' | 'eoddDate'
>

// User State Update Rule Instances are key in UpdatableUserDetails and value is RuleInstance
type UserUpdateRuleInstances = Partial<
  Record<keyof UpdatableUserDetails, RuleInstance>
>

@traceable
export class UserService {
  tenantId: string
  userRepository: UserRepository
  caseRepository: CaseRepository
  userEventRepository: UserEventRepository
  s3: S3
  documentBucketName: string
  tmpBucketName: string
  mongoDb: MongoClient
  dynamoDb: DynamoDBDocumentClient
  awsCredentials?: LambdaCredentials
  userAuditLogService: UserAuditLogService
  userClickhouseRepository: UserClickhouseRepository
  userManagementService: UserManagementService
  riskScoringV8Service: RiskScoringV8Service
  listService: ListService
  workflowService: WorkflowService
  private s3Service: S3Service

  constructor(
    tenantId: string,
    connections: {
      dynamoDb: DynamoDBDocumentClient
      mongoDb: MongoClient
      clickhouseClient?: ClickHouseClient
    },
    s3?: S3,
    tmpBucketName?: string,
    documentBucketName?: string,
    awsCredentials?: LambdaCredentials
  ) {
    this.tenantId = tenantId
    this.userRepository = new UserRepository(tenantId, {
      mongoDb: connections.mongoDb,
      dynamoDb: connections.dynamoDb,
    })
    this.userEventRepository = new UserEventRepository(tenantId, {
      mongoDb: connections.mongoDb,
      dynamoDb: connections.dynamoDb,
    })
    this.caseRepository = new CaseRepository(tenantId, {
      mongoDb: connections.mongoDb,
      dynamoDb: connections.dynamoDb,
    })
    this.userAuditLogService = new UserAuditLogService(tenantId)
    this.s3 = s3 as S3
    this.tmpBucketName = tmpBucketName as string
    this.documentBucketName = documentBucketName as string
    this.s3Service = new S3Service(s3 as S3, {
      documentBucketName: this.documentBucketName,
      tmpBucketName: this.tmpBucketName,
    })
    this.mongoDb = connections.mongoDb as MongoClient
    this.dynamoDb = connections.dynamoDb as DynamoDBDocumentClient
    this.awsCredentials = awsCredentials
    this.userClickhouseRepository = new UserClickhouseRepository(
      tenantId,
      connections.clickhouseClient,
      this.dynamoDb
    )
    const logicEvaluator = new LogicEvaluator(tenantId, this.dynamoDb)
    this.riskScoringV8Service = new RiskScoringV8Service(
      tenantId,
      logicEvaluator,
      {
        mongoDb: this.mongoDb,
        dynamoDb: this.dynamoDb,
      }
    )
    this.userManagementService = new UserManagementService(
      tenantId,
      this.dynamoDb,
      this.mongoDb,
      logicEvaluator
    )
    this.listService = new ListService(
      tenantId,
      {
        mongoDb: this.mongoDb,
        dynamoDb: this.dynamoDb,
      },
      s3,
      {
        documentBucketName: this.documentBucketName,
        tmpBucketName: this.tmpBucketName,
      }
    )
    this.workflowService = new WorkflowService(tenantId, {
      dynamoDb: this.dynamoDb,
      mongoDb: this.mongoDb,
    })
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
    const lambdaCredentials = getCredentialsFromEvent(event)

    const clickhouseClient = isClickhouseEnabled()
      ? await getClickhouseClient(tenantId)
      : undefined

    return new UserService(
      tenantId,
      { mongoDb: client, dynamoDb, clickhouseClient },
      s3,
      TMP_BUCKET,
      DOCUMENT_BUCKET,
      lambdaCredentials
    )
  }

  public async getBusinessUsers(
    params: DefaultApiGetBusinessUsersListRequest
  ): Promise<BusinessUsersOffsetPaginateListResponse> {
    const result = await this.userRepository.getMongoUsersPaginate(
      params,
      this.mapBusinessUserToTableItem,
      'BUSINESS',
      {
        projection: {
          _id: 1,
          userId: 1,
          type: 1,
          createdTimestamp: 1,
          legalEntity: {
            companyGeneralDetails: {
              legalName: 1,
              businessIndustry: 1,
              userRegistrationStatus: 1,
            },
            companyFinancialDetails: {
              expectedTransactionAmountPerMonth: 1,
              expectedTurnoverPerMonth: 1,
            },
            companyRegistrationDetails: {
              registrationIdentifier: 1,
              registrationCountry: 1,
            },
          },
          transactionLimits: {
            maximumDailyTransactionLimit: 1,
          },
          krsScore: {
            krsScore: 1,
            riskLevel: 1,
          },
          drsScore: {
            drsScore: 1,
            derivedRiskLevel: 1,
            manualRiskLevel: 1,
            isUpdatable: 1,
          },
          updatedAt: 1,
          tags: 1,
        },
      }
    )

    return result
  }

  public async getBusinessUsersV2(
    params: DefaultApiGetBusinessUsersListRequest
  ): Promise<BusinessUsersOffsetPaginateListResponse> {
    const columns = {
      ...this.getUserCommonColumns(),
      businessUserName:
        "JSONExtractString(data, 'legalEntity', 'companyGeneralDetails', 'legalName')",
      industry:
        "JSONExtractString(data, 'legalEntity', 'companyGeneralDetails', 'businessIndustry')",
      userRegistrationStatus:
        "JSONExtractString(data, 'legalEntity', 'companyGeneralDetails', 'userRegistrationStatus')",
      expectedTransactionAmountPerMonth:
        "JSONExtractString(data, 'legalEntity', 'companyFinancialDetails', 'expectedTransactionAmountPerMonth')",
      expectedTurnoverPerMonth:
        "JSONExtractString(data, 'legalEntity', 'companyFinancialDetails', 'expectedTurnoverPerMonth')",
      maximumDailyTransactionLimit:
        "JSONExtractString(data, 'transactionLimits', 'maximumDailyTransactionLimit')",
      registrationIdentifier:
        "JSONExtractString(data, 'legalEntity', 'companyRegistrationDetails', 'registrationIdentifier')",
      registrationCountry:
        "JSONExtractString(data, 'legalEntity', 'companyRegistrationDetails', 'registrationCountry')",
    }

    const callback = (
      data: Record<string, string | number>
    ): BusinessUserTableItem => {
      return {
        industry: data.industry ? JSON.parse(data.industry as string) : [],
        name: data.businessUserName as string,
        createdTimestamp: data.createdTimestamp as number,
        type: data.type as UserType,
        updatedAt: data.updatedAt as number,
        tags: data.tags ? JSON.parse(data.tags as string) : [],
        krsScore: data.krsScore as number,
        drsScore: data.drsScore as number,
        isRiskLevelLocked: !data.isRiskLevelLocked,
        manualRiskLevel: data.manualRiskLevel as RiskLevel,
        userId: data.userId as string,
        userRegistrationStatus:
          data.userRegistrationStatus as UserRegistrationStatus,
        expectedVolumes: {
          expectedTransactionAmountPerMonth:
            data.expectedTransactionAmountPerMonth
              ? (JSON.parse(
                  data.expectedTransactionAmountPerMonth as string
                ) as Amount)
              : undefined,
          transactionVolumePerMonth: data.expectedTurnoverPerMonth
            ? (JSON.parse(data.expectedTurnoverPerMonth as string) as Amount)
            : undefined,
          maximumDailyTransactionLimit: data.maximumDailyTransactionLimit
            ? (JSON.parse(
                data.maximumDailyTransactionLimit as string
              ) as Amount)
            : undefined,
        },
        registrationCountry: data.registrationCountry as CountryCode,
        registrationIdentifier: data.registrationIdentifier as string,
      }
    }

    return this.userClickhouseRepository.getUsersV2<BusinessUserTableItem>(
      params,
      columns,
      callback,
      'BUSINESS'
    )
  }

  private getUserCommonColumns(): Record<string, string> {
    return {
      userId: 'id',
      userName: 'username',
      createdTimestamp: "JSONExtractFloat(data, 'createdTimestamp')",
      type: "JSONExtractString(data, 'type')",
      updatedAt: "JSONExtractFloat(data, 'updatedAt')",
      tags: "JSONExtractString(data, 'tags')",
      krsScore: "JSONExtractFloat(data, 'krsScore', 'krsScore')",
      drsScore: "JSONExtractFloat(data, 'drsScore', 'drsScore')",
      isRiskLevelLocked: "JSONExtractBool(data, 'drsScore', 'isUpdatable')",
      kycStatus: "JSONExtractString(data, 'kycStatusDetails', 'status')",
      kycStatusReason: "JSONExtractString(data, 'kycStatusDetails', 'reason')",
      userState: "JSONExtractString(data, 'userStateDetails', 'state')",
      userStateReason: "JSONExtractString(data, 'userStateDetails', 'reason')",
      manualRiskLevel: "JSONExtractString(data, 'drsScore', 'manualRiskLevel')",
      riskLevel: "JSONExtractString(data, 'riskLevel')",
    }
  }

  public async getConsumerUsersV2(
    params: DefaultApiGetConsumerUsersListRequest
  ): Promise<ConsumerUsersOffsetPaginateListResponse> {
    const columns = {
      ...this.getUserCommonColumns(),
      consumerUserName: "JSONExtractString(data, 'userDetails', 'name')",
      pepDetails: "JSONExtractString(data, 'pepStatus')",
      countryOfResidence:
        "JSONExtractString(data, 'userDetails', 'countryOfResidence')",
      countryOfNationality:
        "JSONExtractString(data, 'userDetails', 'countryOfNationality')",
      dateOfBirth: "JSONExtractString(data, 'userDetails', 'dateOfBirth')",
    }

    const callback = (
      data: Record<string, string | number>
    ): ConsumerUserTableItem => {
      return {
        userId: data.userId as string,
        createdTimestamp: data.createdTimestamp as number,
        type: data.type as UserType,
        name: data.consumerUserName
          ? (formatConsumerName(
              JSON.parse(data.consumerUserName as string) as ConsumerName
            ) as string)
          : '',
        pepDetails: (data.pepDetails as string).length
          ? (JSON.parse(data.pepDetails as string) as PEPStatus[])
          : [],
        kycStatus: data.kycStatus as KYCStatus,
        kycStatusReason: data.kycStatusReason as string,
        countryOfResidence: data.countryOfResidence as CountryCode,
        countryOfNationality: data.countryOfNationality as CountryCode,
        userState: data.userState as UserState,
        userStateReason: data.userStateReason as string,
        dateOfBirth: data.dateOfBirth as string,
        tags: data.tags ? JSON.parse(data.tags as string) : [],
        drsScore: data.drsScore as number,
        krsScore: data.krsScore as number,
        isRiskLevelLocked: !data.isRiskLevelLocked,
        manualRiskLevel: data.manualRiskLevel as RiskLevel,
        updatedAt: data.updatedAt as number,
      }
    }

    return this.userClickhouseRepository.getUsersV2<ConsumerUserTableItem>(
      params,
      columns,
      callback,
      'CONSUMER'
    )
  }

  public async getUsersV2(
    params: DefaultApiGetAllUsersListRequest
  ): Promise<AllUsersOffsetPaginateListResponse> {
    const columns = {
      ...this.getUserCommonColumns(),
      consumerUserName: "JSONExtractString(data, 'userDetails', 'name')",
      businessUserName:
        "JSONExtractString(data, 'legalEntity', 'companyGeneralDetails', 'legalName')",
    }

    const callback = (
      data: Record<string, string | number>
    ): AllUsersTableItem => {
      return {
        userId: data.userId as string,
        name: data.consumerUserName
          ? (formatConsumerName(
              JSON.parse(data.consumerUserName as string) as ConsumerName
            ) as string)
          : data.businessUserName
          ? (data.businessUserName as string)
          : '',
        type: data.type as UserType,
        kycStatus: data.kycStatus as KYCStatus,
        userState: data.userState as UserState,
        tags: data.tags ? JSON.parse(data.tags as string) : [],
        createdTimestamp: data.createdTimestamp as number,
        updatedAt: data.updatedAt as number,
        drsScore: data.drsScore as number,
        krsScore: data.krsScore as number,
        isRiskLevelLocked: !data.isRiskLevelLocked,
        manualRiskLevel: data.manualRiskLevel as RiskLevel,
        riskLevel: data.riskLevel as RiskLevel,
      }
    }

    return this.userClickhouseRepository.getUsersV2<AllUsersTableItem>(
      params,
      columns,
      callback
    )
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
    if (
      ruleInstance.type === 'TRANSACTION' &&
      !['ALL', direction].includes(triggersOnHit?.usersToCheck ?? 'ALL')
    ) {
      return
    }
    return triggersOnHit
  }

  private getUserEventData(
    user: User | Business,
    updates: UpdatableUserDetails
  ): UserUpdateRequest {
    const { kycStatusDetails, userStateDetails, pepStatus, tags, eoddDate } =
      updates
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

    if (pepStatus && !isEqual(pepStatus, user['pepStatus'])) {
      updateableData.pepStatus = pepStatus
    }

    if (tags && !isEqual(tags, user['tags'])) {
      updateableData.tags = tags
    }

    if (eoddDate !== undefined && eoddDate !== user['eoddDate']) {
      updateableData.eoddDate = eoddDate
    }

    return updateableData
  }

  private processUserDetails(
    triggersOnHit: TriggersOnHit,
    updates: UpdatableUserDetails,
    ruleInstances: UserUpdateRuleInstances,
    ruleInstance: RuleInstance
  ): {
    updates: UpdatableUserDetails
    ruleInstances: UserUpdateRuleInstances
  } {
    // Improve function types while removing any
    const updateFunctions: Record<
      keyof UpdatableUserDetails,
      (triggersOnHit: TriggersOnHit, details: any) => any
    > = {
      userStateDetails: this.getUserStateDetails,
      kycStatusDetails: this.getKycStatusDetails,
      pepStatus: this.processPepStatusDetails,
      tags: this.processTagDetails,
      eoddDate: (triggersOnHit: TriggersOnHit, eoddDate: number | undefined) =>
        eoddDate,
    }

    for (const key in updateFunctions) {
      const newValue = updateFunctions[key].call(
        this,
        triggersOnHit,
        updates[key]
      )
      if (!isEqual(newValue, updates[key])) {
        ruleInstances[key] = ruleInstance
      }
      updates[key] = newValue
    }

    return {
      updates,
      ruleInstances,
    }
  }

  private processTagDetails(
    triggersOnHit: TriggersOnHit,
    tagDetails: UserTag[] | undefined
  ): UserTag[] | undefined {
    const tags = triggersOnHit.tags
    if (!tags) {
      return tagDetails
    }
    if (!tagDetails) {
      return tags
    }
    return uniq([...tagDetails, ...tags])
  }

  private processPepStatusDetails(
    triggersOnHit: TriggersOnHit,
    pepStatusDetails: PEPStatus[] | undefined
  ): PEPStatus[] | undefined {
    const pepStatus = triggersOnHit.pepStatus
    if (pepStatus == null) {
      return pepStatusDetails
    }
    if (!pepStatusDetails) {
      return [pepStatus]
    }
    pepStatusDetails = this.getUniquePepStatus([...pepStatusDetails, pepStatus])
    return pepStatusDetails
  }

  private getUniquePepStatus(
    pepStatusDetails: PEPStatus[] | undefined
  ): PEPStatus[] | undefined {
    if (!pepStatusDetails) {
      return undefined
    }
    return uniqBy(
      pepStatusDetails,
      (pepStatus) =>
        `${pepStatus.isPepHit ? '1' : '0'}${pepStatus.pepRank ?? ''}${
          pepStatus.pepCountry ?? ''
        }`
    )
  }

  private async saveUserEvents(
    user: User | Business | null,
    details: UpdatableUserDetails,
    ruleInstances: UserUpdateRuleInstances
  ) {
    if (!user) {
      return
    }

    const data = this.getUserEventData(user, details)

    if (!isEmpty(data)) {
      await this.updateUser(user, data, ruleInstances, { bySystem: true })
    }
  }

  private async addUserToList(
    user: InternalUser | null,
    listId: string,
    ruleInstanceId?: string
  ): Promise<void> {
    if (!user?.userId) {
      return
    }

    const userFullName = getUserName(user)
    const listItem: ListItem = {
      key: user.userId,
      metadata: {
        reason: `${ruleInstanceId} rule hit`,
        userFullName,
      },
    }

    await this.listService.updateOrCreateListItem(listId, listItem)
  }

  public async handleUserStatusUpdateTrigger(
    hitRules: HitRulesDetails[],
    ruleInstancesHit: RuleInstance[],
    originUser: InternalUser | null,
    destinationUser: InternalUser | null
  ) {
    const isRiskLevelsEnabled = hasFeature('RISK_LEVELS')

    type UserData = {
      userData: UpdatableUserDetails
      ruleInstances: UserUpdateRuleInstances
    }

    // Helper function to process a single user and save events
    const processUser = async (
      user: InternalUser | null,
      direction: 'ORIGIN' | 'DESTINATION'
    ): Promise<void> => {
      const userData: UserData = {
        userData: { pepStatus: user?.pepStatus, tags: undefined },
        ruleInstances: {},
      }
      for (const ruleInstance of ruleInstancesHit) {
        const hitRulesDetails = hitRules.find(
          (hitRule) => hitRule.ruleInstanceId === ruleInstance.id
        )

        if (
          !hitRulesDetails ||
          !hitRulesDetails.ruleHitMeta?.hitDirections?.includes(direction)
        ) {
          continue
        }

        const triggersOnHit = this.getTriggersOnHit(
          ruleInstance,
          user,
          direction,
          isRiskLevelsEnabled
        )

        if (triggersOnHit) {
          const result = this.processUserDetails(
            triggersOnHit,
            userData.userData,
            userData.ruleInstances,
            ruleInstance
          )
          // Add user to list if listId is set
          if (triggersOnHit.listId) {
            await this.addUserToList(
              user,
              triggersOnHit.listId,
              ruleInstance.id
            )
          }

          Object.assign(userData, result)
        }
      }

      // Save user events
      await this.saveUserEvents(
        user,
        {
          ...userData.userData,
          pepStatus: this.getUniquePepStatus(userData.userData.pepStatus),
          tags: this.getUpdatedTagDetails(userData.userData.tags, user?.tags),
        },
        userData.ruleInstances
      )
    }

    // Process and save events for both users concurrently
    await Promise.all([
      processUser(originUser, 'ORIGIN'),
      processUser(destinationUser, 'DESTINATION'),
    ])
  }

  private getUpdatedTagDetails(
    updateDetails: UserTag[] | undefined,
    userTags: UserTag[] | undefined
  ): UserTag[] | undefined {
    if (!updateDetails) {
      return userTags
    }
    if (!userTags || isEqual(updateDetails, userTags)) {
      return updateDetails
    }

    const updatedTags = mergeUserTags(userTags, updateDetails)
    return updatedTags
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
      WebhookUserStateDetails | WebhookKYCStatusDetails
    >[] = []
    if (
      newUser.userStateDetails &&
      diff(oldUser.userStateDetails ?? {}, newUser.userStateDetails ?? {})
    ) {
      const webhookUserStateDetails: WebhookUserStateDetails = {
        ...newUser.userStateDetails,
        userId: newUser.userId,
      }

      webhookTasks.push({
        event: 'USER_STATE_UPDATED',
        entityId: newUser.userId,
        payload: webhookUserStateDetails,
        triggeredBy: isManual ? 'MANUAL' : 'SYSTEM',
      })
    }

    if (
      newUser.kycStatusDetails &&
      diff(oldUser.kycStatusDetails ?? {}, newUser.kycStatusDetails ?? {})
    ) {
      const webhookKYCStatusDetails: WebhookKYCStatusDetails = {
        ...newUser.kycStatusDetails,
        userId: newUser.userId,
      }

      webhookTasks.push({
        event: 'KYC_STATUS_UPDATED',
        entityId: newUser.userId,
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

  private mapAllUserToTableItem(
    user: InternalUser | InternalBusinessUser | InternalConsumerUser
  ): AllUsersTableItem {
    return {
      isRiskLevelLocked: !user.drsScore?.isUpdatable,
      manualRiskLevel: user.drsScore?.manualRiskLevel,
      kycStatus: user.kycStatusDetails?.status,
      krsScore: user.krsScore?.krsScore,
      createdTimestamp: user.createdTimestamp,
      name: getUserName(user),
      userState: user.userStateDetails?.state,
      type: user.type,
      drsScore: user.drsScore?.drsScore,
      userId: user.userId,
      tags: user.tags,
      updatedAt: user.updatedAt,
      casesCount: user.casesCount,
      riskLevel: user.riskLevel,
    }
  }

  private mapBusinessUserToTableItem(
    user: InternalUser
  ): BusinessUserTableItem {
    return {
      createdTimestamp: user.createdTimestamp,
      name: getUserName(user),
      type: 'BUSINESS',
      userId: user.userId,
      updatedAt: user.updatedAt,
      drsScore: user.drsScore?.drsScore,
      expectedVolumes: {
        expectedTransactionAmountPerMonth:
          user.legalEntity.companyFinancialDetails
            ?.expectedTransactionAmountPerMonth,
        transactionVolumePerMonth:
          user.legalEntity.companyFinancialDetails?.expectedTurnoverPerMonth,
        maximumDailyTransactionLimit:
          user.transactionLimits?.maximumDailyTransactionLimit,
      },
      industry: user.legalEntity.companyGeneralDetails.businessIndustry,
      isRiskLevelLocked: !user.drsScore?.isUpdatable,
      manualRiskLevel: user.drsScore?.manualRiskLevel,
      krsScore: user.krsScore?.krsScore,
      registrationCountry:
        user.legalEntity.companyRegistrationDetails?.registrationCountry,
      tags: user.tags,
      registrationIdentifier:
        user.legalEntity.companyRegistrationDetails?.registrationIdentifier,
      userRegistrationStatus:
        user.legalEntity.companyGeneralDetails.userRegistrationStatus,
    }
  }

  private mapConsumerUserToTableItem(
    user: InternalUser
  ): ConsumerUserTableItem {
    return {
      createdTimestamp: user.createdTimestamp,
      name: getUserName(user),
      type: 'CONSUMER',
      userId: user.userId,
      updatedAt: user.updatedAt,
      countryOfNationality: user.userDetails?.countryOfNationality,
      dateOfBirth: user.userDetails?.dateOfBirth,
      tags: user.tags,
      countryOfResidence: user.userDetails?.countryOfResidence,
      drsScore: user.drsScore?.drsScore,
      krsScore: user.krsScore?.krsScore,
      kycStatus: user.kycStatusDetails?.status,
      userState: user.userStateDetails?.state,
      isRiskLevelLocked: !user.drsScore?.isUpdatable,
      manualRiskLevel: user.drsScore?.manualRiskLevel,
      kycStatusReason: user.kycStatusDetails?.reason,
      pepDetails: user.pepStatus,
    }
  }

  public async getConsumerUsers(
    params: DefaultApiGetConsumerUsersListRequest
  ): Promise<ConsumerUsersOffsetPaginateListResponse> {
    const result = await this.userRepository.getMongoUsersPaginate(
      params,
      this.mapConsumerUserToTableItem,
      'CONSUMER',
      {
        projection: {
          _id: 1,
          userId: 1,
          type: 1,
          createdTimestamp: 1,
          userDetails: {
            name: 1,
            dateOfBirth: 1,
            countryOfResidence: 1,
            countryOfNationality: 1,
          },
          userStateDetails: {
            state: 1,
          },
          kycStatusDetails: {
            status: 1,
            reason: 1,
          },
          pepStatus: 1,
          tags: 1,
          krsScore: {
            krsScore: 1,
            riskLevel: 1,
          },
          drsScore: {
            drsScore: 1,
            derivedRiskLevel: 1,
            manualRiskLevel: 1,
            isUpdatable: 1,
          },
          updatedAt: 1,
        },
      }
    )

    return result
  }

  @auditLog('USER', 'USER_LIST', 'DOWNLOAD')
  public async getUsers(
    params: DefaultApiGetAllUsersListRequest
  ): Promise<AuditLogReturnData<AllUsersOffsetPaginateListResponse>> {
    if (isClickhouseEnabled()) {
      return {
        result: await this.getClickhouseUsers(params),
        entities:
          params.view === 'DOWNLOAD'
            ? [{ entityId: 'USER_DOWNLOAD', entityAction: 'DOWNLOAD' }]
            : [],
        publishAuditLog: () => params.view === 'DOWNLOAD',
      }
    }
    const data = await this.userRepository.getMongoUsersPaginate(
      params,
      this.mapAllUserToTableItem,
      params.filterUserType,
      {
        projection: {
          _id: 1,
          userId: 1,
          createdTimestamp: 1,
          userDetails: {
            name: 1,
          },
          legalEntity: 1,
          userStateDetails: {
            state: 1,
          },
          kycStatusDetails: 1,
          pepStatus: 1,
          tags: 1,
          type: 1,
          krsScore: {
            krsScore: 1,
            riskLevel: 1,
          },
          drsScore: {
            drsScore: 1,
            derivedRiskLevel: 1,
            manualRiskLevel: 1,
            isUpdatable: 1,
          },
          updatedAt: 1,
        },
      }
    )
    return {
      result: data,
      entities:
        params.view === 'DOWNLOAD'
          ? [{ entityId: 'USER_LIST', entityAction: 'DOWNLOAD' }]
          : [],
      publishAuditLog: () => params.view === 'DOWNLOAD',
    }
  }

  public async getUsersPreview(params: DefaultApiGetAllUsersListRequest) {
    const data = await this.userRepository.getMongoUsersPaginate(
      params,
      this.mapAllUserToTableItem,
      params.filterUserType,
      {
        projection: {
          _id: 1,
          userId: 1,
          userDetails: {
            name: 1,
          },
          legalEntity: 1,
          type: 1,
          riskLevel: 1,
        },
      }
    )
    return data
  }

  public async getClickhouseUsers(
    params: DefaultApiGetAllUsersListRequest
  ): Promise<AllUsersOffsetPaginateListResponse> {
    const columns = this.getUserCommonColumns()

    const callback = (
      data: Record<string, string | number>
    ): AllUsersTableItem => {
      return {
        userId: data.userId as string,
        name: data.userName as string,
        type: data.type as UserType,
        kycStatus: data.kycStatus as KYCStatus,
        userState: data.userState as UserState,
        tags: data.tags ? JSON.parse(data.tags as string) : [],
        createdTimestamp: data.createdTimestamp as number,
        updatedAt: data.updatedAt as number,
        drsScore: data.drsScore as number,
        krsScore: data.krsScore as number,
        isRiskLevelLocked: !data.isRiskLevelLocked,
        manualRiskLevel: data.manualRiskLevel as RiskLevel,
        riskLevel: data.riskLevel as RiskLevel,
      }
    }
    const result =
      await this.userClickhouseRepository.getClickhouseUsersPaginate<AllUsersTableItem>(
        params,
        params.filterOperator ?? 'AND',
        params.includeCasesCount ?? false,
        columns,
        callback,
        params.filterUserType
      )

    // count field is returned as string - converting it to number to match the expected response
    // TODO: see if we can fix this in the clickhouse repository for all queries
    return {
      ...result,
      count: Number(result.count),
    }
  }

  public async getClickhouseUsersPreview(
    params: DefaultApiGetAllUsersListRequest
  ): Promise<AllUsersPreviewOffsetPaginateListResponse> {
    const result =
      await this.userClickhouseRepository.getClickhouseUsersPreviewPaginate(
        params
      )

    // count field is returned as string - converting it to number to match the expected response
    // TODO: see if we can fix this in the clickhouse repository for all queries
    return {
      ...result,
      count: Number(result.count),
    }
  }

  public async getRuleInstancesTransactionUsersHit(
    ruleInstanceId: string,
    params: DefaultApiGetRuleInstancesTransactionUsersHitRequest
  ): Promise<AllUsersOffsetPaginateListResponse> {
    const result =
      await this.userRepository.getRuleInstancesTransactionUsersHit(
        ruleInstanceId,
        params,
        this.mapAllUserToTableItem
      )
    return result
  }

  private mergeList(
    comments: Comment[] = [],
    shareHoldersAttachment: PersonAttachment[] = [],
    directorsAttachment: PersonAttachment[] = [],
    userAttachments: PersonAttachment[] = []
  ): Comment[] {
    const mergedComments: Comment[] = []
    let i = 0 // pointer for comments
    let j = 0 // pointer for shareHoldersAttachment
    let k = 0 // pointer for directorsAttachment
    let l = 0 // pointer for userAttachment

    while (
      i < comments.length ||
      j < shareHoldersAttachment.length ||
      k < directorsAttachment.length ||
      l < userAttachments.length
    ) {
      const commentTime =
        i < comments.length ? comments[i].createdAt ?? Infinity : Infinity
      const shareHolderTime =
        j < shareHoldersAttachment.length
          ? shareHoldersAttachment[j].createdAt ?? Infinity
          : Infinity
      const directorTime =
        k < directorsAttachment.length
          ? directorsAttachment[k].createdAt ?? Infinity
          : Infinity
      const userTime =
        l < userAttachments.length
          ? userAttachments[l].createdAt ?? Infinity
          : Infinity

      if (
        commentTime <= shareHolderTime &&
        commentTime <= directorTime &&
        commentTime <= userTime &&
        i < comments.length
      ) {
        mergedComments.push(comments[i])
        i++
      } else if (
        shareHolderTime <= directorTime &&
        shareHolderTime <= userTime &&
        j < shareHoldersAttachment.length
      ) {
        mergedComments.push({
          id: shareHoldersAttachment[j].id,
          body: shareHoldersAttachment[j].comment ?? '-',
          createdAt: shareHoldersAttachment[j].createdAt,
          userId: shareHoldersAttachment[j].userId,
          files: shareHoldersAttachment[j].files,
          isAttachment: true,
        })
        j++
      } else if (directorTime <= userTime && k < directorsAttachment.length) {
        mergedComments.push({
          id: directorsAttachment[k].id,
          body: directorsAttachment[k].comment ?? '-',
          createdAt: directorsAttachment[k].createdAt,
          userId: directorsAttachment[k].userId,
          files: directorsAttachment[k].files,
          isAttachment: true,
        })
        k++
      } else if (l < userAttachments.length) {
        mergedComments.push({
          id: userAttachments[l].id,
          body: userAttachments[l].comment ?? '-',
          createdAt: userAttachments[l].createdAt,
          userId: userAttachments[l].userId,
          files: userAttachments[l].files,
          isAttachment: true,
        })
        l++
      }
    }

    return mergedComments
  }

  private async getDownloadLinks(
    files: FileInfo[],
    arrayIndex: number,
    index: number
  ) {
    return {
      arrayIndex,
      index,
      files: await Promise.all(
        (files ?? []).map(async (file) => ({
          ...file,
          downloadLink: await this.getDownloadLink(file),
        }))
      ),
    }
  }

  public async getUser(
    userId: string,
    getAttachments: boolean
  ): Promise<InternalUser> {
    const user = await this.userRepository.getUserById(userId)

    if (!user) {
      throw new createError.NotFound(`User ${userId} not found`)
    }

    if (!getAttachments || !this.s3 || !this.tmpBucketName) {
      return user
    }

    const comments: Comment[] =
      user.comments?.filter(
        (comment) => !comment.deletedAt || comment.deletedAt === null
      ) ?? []
    const userAttachments: PersonAttachment[] =
      user.attachments?.filter(
        (attachment) => !attachment.deletedAt || attachment.deletedAt === null
      ) ?? []
    const shareHoldersAttachment: PersonAttachment[] =
      user.shareHolders?.flatMap(
        (shareHolder) =>
          shareHolder.attachments?.filter(
            (attachment) =>
              !attachment.deletedAt || attachment.deletedAt === null
          ) ?? []
      ) ?? []
    const directorsAttachment: PersonAttachment[] =
      user.directors?.flatMap(
        (director) =>
          director.attachments?.filter(
            (attachment) =>
              !attachment.deletedAt || attachment.deletedAt === null
          ) ?? []
      ) ?? []

    const promises: Promise<{
      files: FileInfo[]
      arrayIndex: number
      index: number
    }>[] = []

    comments.forEach((comment, i) => {
      promises.push(this.getDownloadLinks(comment.files ?? [], 0, i))
    })
    userAttachments.forEach((attachment, i) => {
      promises.push(this.getDownloadLinks(attachment.files ?? [], 1, i))
    })
    shareHoldersAttachment.forEach((attachment, i) => {
      promises.push(this.getDownloadLinks(attachment.files ?? [], 2, i))
    })
    directorsAttachment.forEach((attachment, i) => {
      promises.push(this.getDownloadLinks(attachment.files ?? [], 3, i))
    })

    const result = await Promise.all(promises)
    result.forEach(({ files, arrayIndex, index }) => {
      if (arrayIndex === 0) {
        comments[index].files = files
      } else if (arrayIndex === 1) {
        userAttachments[index].files = files
      } else if (arrayIndex === 2) {
        shareHoldersAttachment[index].files = files
      } else if (arrayIndex === 3) {
        directorsAttachment[index].files = files
      }
    })

    // merging the three list using three pointer
    const mergedComments = this.mergeList(
      comments,
      shareHoldersAttachment,
      directorsAttachment,
      userAttachments
    )

    return {
      ...user,
      comments: mergedComments,
      attachments: userAttachments,
      shareHolders: user.shareHolders?.map((shareHolder) => {
        return {
          ...shareHolder,
          attachments: shareHolder.attachments?.filter(
            (attachment) =>
              !attachment.deletedAt || attachment.deletedAt === null
          ),
        }
      }),
      directors: user.directors?.map((director) => {
        return {
          ...director,
          attachments: director.attachments?.filter(
            (attachment) =>
              !attachment.deletedAt || attachment.deletedAt === null
          ),
        }
      }),
    }
  }

  public async getBusinessUser(
    userId: string
  ): Promise<InternalBusinessUser | null> {
    const user = await this.getUser(userId, true)

    return user && (await this.getAugmentedUser<InternalBusinessUser>(user))
  }

  public async getConsumerUser(
    userId: string
  ): Promise<InternalConsumerUser | null> {
    const user = await this.getUser(userId, true)
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
    const comments = await Promise.all(
      (user.comments ?? [])
        .filter((comment) => comment.deletedAt == null)
        .map(async (comment) => ({
          ...comment,
          files: await this.getUpdatedFiles(comment.files),
        }))
    )
    return { ...user, comments } as T
  }

  public async updateUser(
    user: User | Business,
    updateRequest: UserUpdateRequest,
    ruleInstances?: UserUpdateRuleInstances,
    options?: { bySystem?: boolean; caseId?: string }
  ): Promise<Comment | null> {
    if (!user) {
      throw new NotFound('User not found')
    }

    const isBusiness = isBusinessUser(user)
    const oldImage = this.createOldImage(user, updateRequest)
    const updatedUser = this.createUpdatedUser(user, updateRequest, isBusiness)

    const shouldSaveUser = Object.keys(updateRequest).some(
      (key) =>
        updateRequest[key] != null && !isEqual(updateRequest[key], user[key])
    )

    if (!shouldSaveUser) {
      return null
    }

    const userToUpdate = pick(updatedUser, DYNAMO_ONLY_USER_ATTRIBUTES)

    // Save user
    if (isBusiness) {
      await this.userRepository.saveBusinessUser(userToUpdate as Business)
    } else {
      await this.userRepository.saveConsumerUser(userToUpdate as User)
    }

    // Handle risk scoring update
    const userUpdatedRiskScore =
      await this.riskScoringV8Service.handleUserUpdate({ user: updatedUser })

    // Save user event
    await this.userEventRepository.saveUserEvent(
      {
        timestamp: Date.now(),
        userId: user.userId,
        reason: updateRequest.userStateDetails?.reason ?? 'User update',
        updatedConsumerUserAttributes: updateRequest,
        riskScoreDetails: {
          kycRiskScore: userUpdatedRiskScore.kycRiskScore,
          craRiskScore: userUpdatedRiskScore.craRiskScore,
        },
      },
      isBusiness ? 'BUSINESS' : 'CONSUMER'
    )

    // Handle post-update actions
    const [_, comment] = await Promise.all([
      this.handleTagsUpdate(user, updateRequest, ruleInstances, options),
      this.handleKycAndUserUpdate(
        user,
        updateRequest,
        updatedUser,
        ruleInstances,
        options
      ),
      this.handlePepStatusUpdate(user, updateRequest, ruleInstances, options),
      this.handleSanctionsStatusUpdate(user, updateRequest, options),
      this.handleAdverseMediaStatusUpdate(user, updateRequest, options),
      this.handleAuditLog(updateRequest, oldImage, user.userId),
    ])

    return comment || null
  }

  private createOldImage(
    user: User | Business,
    updateRequest: UserUpdateRequest
  ): UserUpdateRequest {
    return Object.keys(updateRequest).reduce((acc, key) => {
      acc[key] = key === 'pepStatus' ? (user as User).pepStatus : user[key]
      return acc
    }, {} as UserUpdateRequest)
  }

  private createUpdatedUser(
    user: User | Business,
    updateRequest: UserUpdateRequest,
    isBusiness: boolean
  ): User | Business {
    return {
      ...user,
      ...this.getUserEventData(user, updateRequest),
      transactionLimits: updateRequest.transactionLimits
        ? {
            ...user.transactionLimits,
            paymentMethodLimits:
              updateRequest.transactionLimits.paymentMethodLimits,
          }
        : undefined,
      ...(!isBusiness && updateRequest.pepStatus?.length
        ? { pepStatus: this.getUniquePepStatus(updateRequest.pepStatus) }
        : {}),
      ...(!isBusiness &&
        updateRequest && {
          sanctionsStatus:
            !!updateRequest.sanctionsStatus === updateRequest.sanctionsStatus
              ? updateRequest.sanctionsStatus
              : (user as User).sanctionsStatus,
        }),
      ...(!isBusiness &&
        updateRequest && {
          adverseMediaStatus:
            !!updateRequest.adverseMediaStatus ===
            updateRequest.adverseMediaStatus
              ? updateRequest.adverseMediaStatus
              : (user as User).adverseMediaStatus,
        }),
      ...(updateRequest.tags && { tags: updateRequest.tags }),
      ...(updateRequest.eoddDate !== undefined && {
        eoddDate: updateRequest.eoddDate,
      }),
    }
  }

  private handleTagsUpdate(
    user: User | Business,
    updateRequest: UserUpdateRequest,
    ruleInstances?: UserUpdateRuleInstances,
    options?: { bySystem?: boolean }
  ) {
    return updateRequest.tags
      ? this.handlePostActionForTagsUpdate(user, updateRequest, {
          bySystem: options?.bySystem,
          tagDetailsRuleInstance: ruleInstances?.tags,
        })
      : null
  }

  private handleKycAndUserUpdate(
    user: User | Business,
    updateRequest: UserUpdateRequest,
    updatedUser: User | Business,
    ruleInstances?: UserUpdateRuleInstances,
    options?: { bySystem?: boolean; caseId?: string }
  ) {
    return updateRequest.kycStatusDetails || updateRequest.userStateDetails
      ? this.handlePostActionForKycAndUserUpdate(
          user,
          updateRequest,
          updatedUser,
          {
            bySystem: options?.bySystem,
            kycRuleInstance: ruleInstances?.kycStatusDetails,
            userStateRuleInstance: ruleInstances?.userStateDetails,
            caseId: options?.caseId,
          }
        )
      : null
  }

  private handlePepStatusUpdate(
    user: User | Business,
    updateRequest: UserUpdateRequest,
    ruleInstances?: UserUpdateRuleInstances,
    options?: { bySystem?: boolean }
  ) {
    return updateRequest.pepStatus != null && !isBusinessUser(user)
      ? this.handlePostActionsForPepStatusUpdate(user, updateRequest, {
          bySystem: options?.bySystem,
          pepStatusRuleInstance: ruleInstances?.pepStatus,
        })
      : null
  }

  private handleSanctionsStatusUpdate(
    user: User | Business,
    updateRequest: UserUpdateRequest,
    options?: { bySystem?: boolean }
  ) {
    return updateRequest.sanctionsStatus != null && !isBusinessUser(user)
      ? this.handlePostActionsForSanctionsStatusUpdate(user, updateRequest, {
          bySystem: options?.bySystem,
        })
      : null
  }

  private handleAdverseMediaStatusUpdate(
    user: User | Business,
    updateRequest: UserUpdateRequest,
    options?: { bySystem?: boolean }
  ) {
    return updateRequest.adverseMediaStatus != null && !isBusinessUser(user)
      ? this.handlePostActionsForAdverseMediaStatusUpdate(user, updateRequest, {
          bySystem: options?.bySystem,
        })
      : null
  }

  private handleAuditLog(
    updateRequest: UserUpdateRequest,
    oldImage: UserUpdateRequest,
    userId: string
  ) {
    return updateRequest.kycStatusDetails ||
      updateRequest.userStateDetails ||
      updateRequest.pepStatus
      ? this.userAuditLogService.handleAuditLogForUserUpdate(
          updateRequest,
          oldImage,
          userId
        )
      : null
  }

  private async handlePostActionForTagsUpdate(
    user: User | Business,
    updateRequest: UserUpdateRequest,
    options?: {
      bySystem?: boolean
      tagDetailsRuleInstance?: RuleInstance
    }
  ) {
    if (!updateRequest.tags) {
      return
    }
    const webhookTasks: ThinWebhookDeliveryTask<UserTagsUpdate>[] = []

    // tags that are in updateRequest.tags but not in user.tags or whose values are updated from user.tags to updateRequest.tags
    const newOrUpdatedTags = updateRequest.tags?.filter((newTag) => {
      const oldTag = user.tags?.find((oldTag) => oldTag.key === newTag.key)
      return !oldTag || oldTag.value !== newTag.value
    })

    // tags that are in user.tags but not in updateRequest.tags (deleted tags)
    const deletedTags = user.tags?.filter(
      (oldTag) =>
        !updateRequest.tags?.some((newTag) => newTag.key === oldTag.key)
    )

    if (newOrUpdatedTags?.length) {
      webhookTasks.push({
        event: 'USER_TAGS_UPDATED',
        entityId: user.userId,
        payload: {
          userId: user.userId,
          tags: newOrUpdatedTags,
        },
        triggeredBy: 'MANUAL',
      })
    }

    if (deletedTags?.length) {
      webhookTasks.push({
        event: 'USER_TAGS_DELETED',
        entityId: user.userId,
        payload: {
          userId: user.userId,
          tags: deletedTags,
        },
        triggeredBy: 'MANUAL',
      })
    }

    const commentBody = options?.tagDetailsRuleInstance
      ? `User API tags updated due to hit of rule ${options?.tagDetailsRuleInstance?.id}`
      : 'User API tags updated over the console'
    const isPnbInternalTagUpdate =
      hasFeature('PNB') &&
      PNB_INTERNAL_RULES.find(
        (rule) => options?.tagDetailsRuleInstance?.id === rule.id
      )
    //PNB internal logic to update the risk level status
    if (
      isPnbInternalTagUpdate &&
      newOrUpdatedTags.find((tag) => tag.key === 'RISK_LEVEL_STATUS')
    ) {
      await Promise.all([
        this.userAuditLogService.handleAuditLogForTagsUpdate(
          user.userId,
          updateRequest.tags
        ),
        handleInternalTagUpdateForPNB({
          user,
          updateRequest,
          userRepository: this.userRepository,
          riskScoringV8Service: this.riskScoringV8Service,
          mongoDb: this.mongoDb,
          dynamoDb: this.dynamoDb,
        }),
      ])
      return
    }
    const [savedComment] = await Promise.all([
      this.userRepository.saveUserComment(user.userId, {
        body: commentBody,
        createdAt: Date.now(),
        userId: options?.bySystem
          ? FLAGRIGHT_SYSTEM_USER
          : (getContext()?.user?.id as string),
        updatedAt: Date.now(),
      }),
      this.userAuditLogService.handleAuditLogForTagsUpdate(
        user.userId,
        updateRequest.tags
      ),
      sendWebhookTasks(this.userRepository.tenantId, webhookTasks),
    ])
    return savedComment || null
  }

  private async handlePostActionForKycAndUserUpdate(
    user: User | Business,
    updateRequest: UserUpdateRequest,
    updatedUser: User | Business,
    options?: {
      bySystem?: boolean
      kycRuleInstance?: RuleInstance
      userStateRuleInstance?: RuleInstance
      caseId?: string
    }
  ) {
    const commentBody = this.getKycAndUserUpdateComment({
      caseId: options?.caseId,
      kycRuleInstance: options?.kycRuleInstance,
      kycStatusDetails: updateRequest.kycStatusDetails,
      userStateDetails: updateRequest.userStateDetails,
      comment: updateRequest.comment?.body,
      userStateRuleInstance: options?.userStateRuleInstance,
    })

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
      this.sendUserAndKycWebhook(user, updatedUser, options?.bySystem ?? false),
    ])
    return savedComment
  }

  private async handlePostActionsForPepStatusUpdate(
    user: User | Business,
    updateRequest: UserUpdateRequest,
    options?: {
      bySystem?: boolean
      pepStatusRuleInstance?: RuleInstance
    }
  ) {
    const commentBody =
      'PEP status updated ' +
      (options?.pepStatusRuleInstance
        ? `due to hit of rule ${options?.pepStatusRuleInstance?.id}`
        : 'manually by ' + (getContext()?.user?.email as string))
    const [savedComment] = await Promise.all([
      this.userRepository.saveUserComment(user.userId, {
        body: commentBody,
        createdAt: Date.now(),
        userId: options?.bySystem
          ? FLAGRIGHT_SYSTEM_USER
          : (getContext()?.user?.id as string),
        updatedAt: Date.now(),
      }),
      sendWebhookTasks(this.userRepository.tenantId, [
        {
          event: 'PEP_STATUS_UPDATED',
          entityId: user.userId,
          payload: {
            userId: user.userId,
            pepStatus: updateRequest.pepStatus,
          },
          triggeredBy: options?.bySystem ? 'SYSTEM' : 'MANUAL',
        },
      ]),
    ])
    return savedComment
  }

  private async handlePostActionsForSanctionsStatusUpdate(
    user: User | Business,
    updateRequest: UserUpdateRequest,
    options?: {
      bySystem?: boolean
      sanctionsStatusRuleInstance?: RuleInstance
    }
  ) {
    const commentBody =
      'Sanctions status updated ' +
      (options?.sanctionsStatusRuleInstance
        ? `due to hit of rule ${options?.sanctionsStatusRuleInstance?.id}`
        : 'manually by ' + (getContext()?.user?.email as string))
    const [savedComment] = await Promise.all([
      this.userRepository.saveUserComment(user.userId, {
        body: commentBody,
        createdAt: Date.now(),
        userId: options?.bySystem
          ? FLAGRIGHT_SYSTEM_USER
          : (getContext()?.user?.id as string),
        updatedAt: Date.now(),
      }),
      sendWebhookTasks(this.userRepository.tenantId, [
        {
          event: 'SANCTIONS_STATUS_UPDATED',
          entityId: user.userId,
          payload: {
            userId: user.userId,
            sanctionsStatus: updateRequest.sanctionsStatus,
          },
          triggeredBy: options?.bySystem ? 'SYSTEM' : 'MANUAL',
        },
      ]),
    ])
    return savedComment
  }

  private async handlePostActionsForAdverseMediaStatusUpdate(
    user: User | Business,
    updateRequest: UserUpdateRequest,
    options?: {
      bySystem?: boolean
      adverseMediaStatusRuleInstance?: RuleInstance
    }
  ) {
    const commentBody =
      'Adverse media status updated ' +
      (options?.adverseMediaStatusRuleInstance
        ? `due to hit of rule ${options?.adverseMediaStatusRuleInstance?.id}`
        : 'manually by ' + (getContext()?.user?.email as string))
    const [savedComment] = await Promise.all([
      this.userRepository.saveUserComment(user.userId, {
        body: commentBody,
        createdAt: Date.now(),
        userId: options?.bySystem
          ? FLAGRIGHT_SYSTEM_USER
          : (getContext()?.user?.id as string),
        updatedAt: Date.now(),
      }),
      sendWebhookTasks(this.userRepository.tenantId, [
        {
          event: 'ADVERSE_MEDIA_STATUS_UPDATED',
          entityId: user.userId,
          payload: {
            userId: user.userId,
            adverseMediaStatus: updateRequest.adverseMediaStatus,
          },
          triggeredBy: options?.bySystem ? 'SYSTEM' : 'MANUAL',
        },
      ]),
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
    const files = await this.s3Service.copyFilesToPermanentBucket(
      comment.files ?? []
    )

    const savedComment = await this.userRepository.saveUserComment(userId, {
      ...comment,
      files,
    })

    if (
      comment.files?.length &&
      savedComment.id &&
      hasFeature('FILES_AI_SUMMARY')
    ) {
      await sendBatchJobCommand({
        type: 'FILES_AI_SUMMARY',
        tenantId: this.userRepository.tenantId,
        parameters: {
          type: 'USER',
          entityId: userId,
          commentId: savedComment.id,
        },
        awsCredentials: this.awsCredentials,
      })
    }
    await this.userAuditLogService.handleAuditLogForAddComment(userId, {
      ...comment,
      body: getParsedCommentBody(comment.body),
      files: comment.files,
    })
    return {
      ...savedComment,
      files: await this.getUpdatedFiles(savedComment.files),
    }
  }

  public async saveUserAttachment(
    userId: string,
    id: string,
    userType: string,
    attachment: PersonAttachment
  ) {
    const files = await this.s3Service.copyFilesToPermanentBucket(
      attachment.files as FileInfo[]
    )
    let savedAttachment: PersonAttachment
    if (userType === 'SHAREHOLDER') {
      savedAttachment = await this.userRepository.saveShareHolderAttachment(
        userId,
        id,
        {
          ...attachment,
          files: files,
        }
      )
    } else if (userType === 'DIRECTOR') {
      savedAttachment = await this.userRepository.saveDirectorAttachment(
        userId,
        id,
        {
          ...attachment,
          files: files,
        }
      )
    } else {
      savedAttachment = await this.userRepository.saveUserAttachment(id, {
        ...attachment,
        files: files,
      })
    }

    return {
      ...savedAttachment,
      files: await this.getUpdatedFiles(files),
    }
  }

  public async saveUserCommentExternal(
    userId: string,
    comment: CommentRequest
  ) {
    const savedComment = await this.saveUserComment(userId, {
      ...comment,
      createdAt: comment.createdTimestamp ?? Date.now(),
      updatedAt: comment.createdTimestamp ?? Date.now(),
      userId: API_USER,
    })
    return getExternalComment(savedComment)
  }

  public async getUserCommentsExternal(userId: string) {
    const user = await this.getUser(userId, true)

    if (!user) {
      throw new createError.NotFound(`User ${userId} not found`)
    }

    return ((await this.getAugmentedUser(user)).comments ?? []).map(
      getExternalComment
    )
  }

  public async getUserComment(userId: string, commentId: string) {
    const user = await this.getUser(userId, true)

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
    const user = await this.getUser(userId, true)

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

    await this.userAuditLogService.handleAuditLogForAddComment(userId, {
      ...reply,
      body: getParsedCommentBody(reply.body),
    })
    return {
      ...savedReply,
      files: await this.getUpdatedFiles(savedReply.files),
    }
  }

  @auditLog('USER', 'COMMENT', 'DELETE')
  public async deleteUserComment(
    userId: string,
    commentId: string
  ): Promise<AuditLogReturnData<void, Comment>> {
    const user = await this.getUser(userId, true)

    if (!user) {
      throw new createError.NotFound(`User ${userId} not found`)
    }

    let deleteObjectsPromise: Promise<any> = Promise.resolve()

    let attachment = user?.attachments?.find(
      (attachment) => attachment.id === commentId
    )
    if (attachment) {
      if (attachment.files && attachment.files.length > 0) {
        deleteObjectsPromise = this.s3.deleteObjects({
          Bucket: this.documentBucketName,
          Delete: {
            Objects: attachment.files.map((file) => ({ Key: file.s3Key })),
          },
        })

        let deleteCommentPromise: Promise<void> = Promise.resolve()

        deleteCommentPromise = this.userRepository.deleteUserAttachment(
          userId,
          commentId
        )

        await Promise.all([deleteObjectsPromise, deleteCommentPromise])

        return {
          entities: [
            {
              oldImage: user.comments?.find((c) => c.id === commentId),
              entityId: userId,
            },
          ],
          result: undefined,
        }
      }
    }
    let shareHolderId: string | undefined = undefined
    user?.shareHolders?.forEach((shareHolder) =>
      shareHolder.attachments?.forEach((a) => {
        shareHolderId = shareHolder.userId
        if (a.id === commentId) {
          attachment = a
        }
      })
    )
    if (attachment && shareHolderId) {
      if (attachment.files && attachment.files.length > 0) {
        deleteObjectsPromise = this.s3.deleteObjects({
          Bucket: this.documentBucketName,
          Delete: {
            Objects: attachment.files.map((file) => ({ Key: file.s3Key })),
          },
        })

        let deleteCommentPromise: Promise<void> = Promise.resolve()

        deleteCommentPromise = this.userRepository.deleteShareHolderAttachment(
          userId,
          shareHolderId,
          commentId
        )

        await Promise.all([deleteObjectsPromise, deleteCommentPromise])

        return {
          entities: [
            {
              oldImage: user.comments?.find((c) => c.id === commentId),
              entityId: userId,
            },
          ],
          result: undefined,
        }
      }
    }
    let directorId: string | undefined = undefined
    user?.directors?.forEach((director) =>
      director.attachments?.forEach((a) => {
        directorId = director.userId
        if (a.id === commentId) {
          attachment = a
        }
      })
    )
    if (attachment && directorId) {
      if (attachment.files && attachment.files.length > 0) {
        deleteObjectsPromise = this.s3.deleteObjects({
          Bucket: this.documentBucketName,
          Delete: {
            Objects: attachment.files.map((file) => ({ Key: file.s3Key })),
          },
        })

        let deleteCommentPromise: Promise<void> = Promise.resolve()

        deleteCommentPromise = this.userRepository.deleteDirectorAttachment(
          userId,
          directorId,
          commentId
        )

        await Promise.all([deleteObjectsPromise, deleteCommentPromise])

        return {
          entities: [
            {
              oldImage: user.comments?.find((c) => c.id === commentId),
              entityId: userId,
            },
          ],
          result: undefined,
        }
      }
    }

    const comment = user?.comments?.find((comment) => comment.id === commentId)
    if (!comment) {
      throw new createError.NotFound(`Comment ${commentId} not found`)
    }

    if (comment.files && comment.files.length > 0) {
      deleteObjectsPromise = this.s3.deleteObjects({
        Bucket: this.documentBucketName,
        Delete: { Objects: comment.files.map((file) => ({ Key: file.s3Key })) },
      })
    }

    let deleteCommentPromise: Promise<void> = Promise.resolve()

    deleteCommentPromise = this.userRepository.deleteUserComment(
      userId,
      commentId
    )

    await Promise.all([deleteObjectsPromise, deleteCommentPromise])

    return {
      entities: [
        {
          oldImage: user.comments?.find((c) => c.id === commentId),
          entityId: userId,
        },
      ],
      result: undefined,
    }
  }

  public async searchUsers(
    params: DefaultApiGetUsersSearchRequest
  ): Promise<UsersSearchResponse> {
    if (isClickhouseEnabled()) {
      const result = await this.userClickhouseRepository.usersSearchExternal(
        params
      )
      const items = result.items.map((user) => internalUserToExternalUser(user))
      return {
        ...omit(result, ['limit']),
        items,
      }
    }

    const result = await this.userRepository.usersSearchExternal(params)
    const items = result.items.map((user) => internalUserToExternalUser(user))
    return {
      ...omit(result, ['limit']),
      items,
    }
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

  public async importFlatFile(request: UserFlatFileUploadRequest) {
    const { file, type } = request

    const files = await this.s3Service.copyFilesToPermanentBucket([file])
    await sendBatchJobCommand({
      tenantId: this.tenantId,
      type: 'FLAT_FILES_VALIDATION',
      parameters: {
        format: 'CSV',
        entityId: type === 'CONSUMER' ? 'CONSUMER_USERS' : 'BUSINESS_USERS',
        s3Key: files[0].s3Key,
        schema:
          type === 'CONSUMER'
            ? 'CONSUMER_USERS_UPLOAD'
            : 'BUSINESS_USERS_UPLOAD',
      },
    })
  }

  @auditLog('USER', 'USER_CHANGE_PROPOSAL', 'CREATE')
  public async proposeUserFieldChange(
    userId: string,
    proposedChange: UserProposedChange,
    comment: string,
    createdBy: string
  ): Promise<AuditLogReturnData<UserApproval>> {
    // Fetch tenant settings to get workflow mapping
    const settings: TenantSettings = await tenantSettings(this.tenantId)
    const workflowId =
      settings.workflowSettings?.userApprovalWorkflows?.[proposedChange.field]

    if (!workflowId) {
      // No workflow configured - automatically apply the change
      console.log(
        `No workflow configured for field: ${proposedChange.field}. Auto-approving change for user: ${userId}`
      )

      const oldUser = await this.userRepository.getUser<
        UserWithRulesResult | BusinessWithRulesResult
      >(userId)
      if (!oldUser) {
        throw new createError.NotFound('User not found')
      }

      // Create update request from the proposed change
      const updateRequest: UserUpdateRequest = {} as UserUpdateRequest
      ;(updateRequest as any)[proposedChange.field] = proposedChange.value

      // Use the existing updateUser method to apply the change
      // This ensures all the proper validation, audit logging, and side effects are handled
      await this.updateUser(oldUser, updateRequest, undefined, {
        bySystem: true,
      })

      // Return a mock approval object indicating the change was auto-approved
      // This allows the frontend to know that the change was processed successfully
      const timestamp = Date.now()
      const autoApproval = new UserApproval()
      autoApproval.id = timestamp
      autoApproval.userId = userId
      autoApproval.proposedChanges = [proposedChange]
      autoApproval.comment = comment
      autoApproval.workflowRef = { id: 'auto-approved', version: 1 }
      autoApproval.approvalStatus = 'APPROVED'
      autoApproval.approvalStep = 0
      autoApproval.createdAt = timestamp
      autoApproval.createdBy = createdBy

      return {
        entities: [
          {
            entityId: userId,
            entityType: 'USER',
            entitySubtype: 'USER_CHANGE_PROPOSAL',
            entityAction: 'CREATE',
            oldImage: undefined,
            newImage: autoApproval,
          },
        ],
        result: autoApproval,
        publishAuditLog: () => true,
      }
    }

    // Workflow exists - proceed with normal approval process
    const workflow = await this.workflowService.getWorkflow(
      'user-update-approval',
      workflowId
    )

    // Check if the proposer should skip the first approval step
    const autoSkipResult = await shouldSkipFirstApprovalStep(
      createdBy,
      workflow,
      this.tenantId,
      this.dynamoDb
    )

    const timestamp = Date.now()

    if (autoSkipResult.isAutoApproved) {
      // Single step workflow where proposer is the first approver - auto-approve
      console.log(
        `Auto-approving user change for ${userId} - proposer ${createdBy} has first approver role in single-step workflow`
      )

      const oldUser = await this.userRepository.getUser<
        UserWithRulesResult | BusinessWithRulesResult
      >(userId)
      if (!oldUser) {
        throw new createError.NotFound('User not found')
      }

      // Apply all the proposed changes using the same method used in normal approvals
      await this.applyUserApprovalChanges(userId, oldUser, [proposedChange])

      // Return a mock approval object indicating the change was auto-approved
      const autoApproval = new UserApproval()
      autoApproval.id = timestamp
      autoApproval.userId = userId
      autoApproval.proposedChanges = [proposedChange]
      autoApproval.comment = comment
      autoApproval.workflowRef = { id: workflow.id, version: workflow.version }
      autoApproval.approvalStatus = 'APPROVED'
      autoApproval.approvalStep = 0
      autoApproval.createdAt = timestamp
      autoApproval.createdBy = createdBy

      return {
        entities: [
          {
            entityId: userId,
            entityType: 'USER',
            entitySubtype: 'USER_CHANGE_PROPOSAL',
            entityAction: 'CREATE',
            oldImage: undefined,
            newImage: autoApproval,
          },
        ],
        result: autoApproval,
        publishAuditLog: () => true,
      }
    }

    // Either no auto-skip or multi-step workflow - create pending approval
    const approval: UserApproval = {
      id: timestamp,
      userId,
      proposedChanges: [proposedChange],
      comment,
      workflowRef: { id: workflow.id, version: workflow.version },
      approvalStatus: 'PENDING',
      approvalStep: autoSkipResult.startingStep,
      createdAt: timestamp,
      createdBy,
    }

    const savedApproval = await this.userRepository.setPendingUserApproval(
      approval
    )

    if (autoSkipResult.shouldSkip && !autoSkipResult.isAutoApproved) {
      console.log(
        `Skipped first approval step for user change ${userId} - proposer ${createdBy} has first approver role, starting at step ${autoSkipResult.startingStep}`
      )
    }

    return {
      entities: [
        {
          entityId: userId,
          entityType: 'USER',
          entitySubtype: 'USER_CHANGE_PROPOSAL',
          entityAction: 'CREATE',
          oldImage: undefined,
          newImage: savedApproval,
        },
      ],
      result: savedApproval,
      publishAuditLog: () => true,
    }
  }

  // Get a specific user approval proposal
  public async getUserApprovalProposal(
    userId: string,
    id: number
  ): Promise<UserApproval | null> {
    return this.userRepository.getPendingUserApproval(userId, id)
  }

  // Get all pending user approval proposals for a user
  public async getUserApprovalProposals(
    userId: string
  ): Promise<UserApproval[]> {
    return this.userRepository.getPendingUserApprovalsForUser(userId)
  }

  // List all pending user approval proposals
  public async listUserApprovalProposals(): Promise<UserApproval[]> {
    return this.userRepository.getAllPendingUserApprovals()
  }

  // Delete a user approval proposal
  public async deleteUserApprovalProposal(
    userId: string,
    id: number
  ): Promise<void> {
    const deleted = await this.userRepository.deletePendingUserApproval(
      userId,
      id
    )
    if (!deleted) {
      throw new createError.NotFound('User approval proposal not found')
    }
  }

  private async applyUserApprovalChanges(
    userId: string,
    oldUser: UserWithRulesResult | BusinessWithRulesResult,
    proposedChanges: any[]
  ): Promise<void> {
    // Handle CRA fields through the risk service
    // Cra = risk level value, CraLock = isUpdatable flag
    const craChange = proposedChanges.find((change) => change.field === 'Cra')
    const craLockChange = proposedChanges.find(
      (change) => change.field === 'CraLock'
    )

    // Handle CRA level changes (requires account to be unlocked)
    if (craChange) {
      const riskService = new RiskService(this.tenantId, {
        dynamoDb: this.dynamoDb,
        mongoDb: this.mongoDb,
      })

      // Check if the account is currently locked
      const currentRiskAssignment = await riskService.getRiskAssignment(userId)
      if (currentRiskAssignment?.isUpdatable === false) {
        throw new createError.BadRequest(
          'Cannot change CRA level when the account is locked. Please unlock the account first.'
        )
      }

      const newRiskLevel = craChange.value as RiskLevel
      const newIsUpdatable =
        (craLockChange?.value as boolean) ??
        currentRiskAssignment?.isUpdatable ??
        true

      await riskService.createOrUpdateRiskAssignment(
        userId,
        newRiskLevel,
        newIsUpdatable
      )
      console.log(
        `CRA level and lock updated for user ${userId}: riskLevel=${newRiskLevel}, isUpdatable=${newIsUpdatable}`
      )
    }

    // Handle CRA lock changes (independent of CRA level)
    if (craLockChange) {
      const riskService = new RiskService(this.tenantId, {
        dynamoDb: this.dynamoDb,
        mongoDb: this.mongoDb,
      })

      const newIsUpdatable = craLockChange.value as boolean
      await riskService.updateRiskAssignmentLock(userId, newIsUpdatable)
      console.log(
        `CRA lock updated for user ${userId}: isUpdatable=${newIsUpdatable}`
      )
    }

    // Handle other fields through the standard updateUser method
    const otherFields = proposedChanges.filter(
      (change) => change.field !== 'Cra' && change.field !== 'CraLock'
    )

    if (otherFields.length > 0) {
      const updateRequest: UserUpdateRequest = {} as UserUpdateRequest

      for (const change of otherFields) {
        if (change.field === 'PepStatus') {
          // Handle PepStatus field specially - it contains multiple sub-fields
          const pepStatusValue = change.value as any
          if (pepStatusValue.pepStatus) {
            ;(updateRequest as any).pepStatus = pepStatusValue.pepStatus
          }
          if (pepStatusValue.adverseMediaStatus !== undefined) {
            ;(updateRequest as any).adverseMediaStatus =
              pepStatusValue.adverseMediaStatus
          }
          if (pepStatusValue.sanctionsStatus !== undefined) {
            ;(updateRequest as any).sanctionsStatus =
              pepStatusValue.sanctionsStatus
          }
        } else {
          // Apply other changes directly to the update request
          ;(updateRequest as any)[change.field] = change.value
        }
      }

      // Use the existing updateUser method to apply the changes
      console.log(
        `About to call updateUser with:`,
        JSON.stringify(updateRequest, null, 2)
      )
      console.log(
        `Old user before update:`,
        JSON.stringify(
          {
            pepStatus: (oldUser as any).pepStatus,
            adverseMediaStatus: (oldUser as any).adverseMediaStatus,
            sanctionsStatus: (oldUser as any).sanctionsStatus,
          },
          null,
          2
        )
      )

      await this.updateUser(oldUser, updateRequest, undefined, {
        bySystem: true,
      })

      // Verify the update worked by fetching the user again
      const updatedUser = await this.userRepository.getUser<
        UserWithRulesResult | BusinessWithRulesResult
      >(userId)
      console.log(
        `User after update:`,
        JSON.stringify(
          {
            pepStatus: (updatedUser as any)?.pepStatus,
            adverseMediaStatus: (updatedUser as any)?.adverseMediaStatus,
            sanctionsStatus: (updatedUser as any)?.sanctionsStatus,
          },
          null,
          2
        )
      )

      console.log(
        `Standard fields updated for user ${userId} through updateUser method`
      )
    }
  }

  // Approve or reject a user approval proposal
  @auditLog('USER', 'USER_CHANGE_PROPOSAL', 'UPDATE')
  public async processUserApproval(
    userId: string,
    id: number,
    request: UserApprovalRequest
  ): Promise<AuditLogReturnData<UserApproval>> {
    const approval = await this.getUserApprovalProposal(userId, id)
    if (!approval) {
      throw new createError.NotFound('User approval proposal not found')
    }
    if (approval.approvalStatus !== 'PENDING') {
      throw new createError.BadRequest('Approval already processed')
    }

    // validate action
    if (
      request.action !== 'accept' &&
      request.action !== 'reject' &&
      request.action !== 'cancel'
    ) {
      throw new createError.BadRequest('Invalid action')
    }

    // Handle cancel action - only the author can cancel at step 0
    if (request.action === 'cancel') {
      const currentUserId = getContext()?.user?.id
      if (!currentUserId) {
        throw new createError.BadRequest('User context not available')
      }

      // Only the author can cancel the proposal
      if (approval.createdBy !== currentUserId) {
        throw new createError.BadRequest(
          'Only the author can cancel the proposal'
        )
      }

      // Only allow cancellation at step 0 (first step)
      if (approval.approvalStep !== 0) {
        throw new createError.BadRequest(
          'Can only cancel at the first step of approval'
        )
      }

      // Delete the approval object from database
      await this.userRepository.deletePendingUserApproval(userId, id)

      return {
        entities: [
          {
            entityId: userId,
            entityType: 'USER',
            entitySubtype: 'USER_CHANGE_PROPOSAL',
            entityAction: 'UPDATE',
            oldImage: approval,
            newImage: { ...approval, approvalStatus: 'CANCELLED' },
          },
        ],
        result: { ...approval, approvalStatus: 'CANCELLED' },
      }
    }

    // fetch the workflow definition
    const wRef = approval.workflowRef
    if (!wRef) {
      throw new createError.BadRequest('No workflow reference found')
    }

    const workflow = await this.workflowService.getWorkflowVersion(
      'user-update-approval',
      wRef.id,
      wRef.version.toString()
    )
    const workflowMachine = new UserUpdateApprovalWorkflowMachine(
      workflow as UserUpdateApprovalWorkflow
    )

    // ensure the user performing the action has the role referenced in the current step of the workflow
    const currentStep = workflowMachine.getApprovalStep(approval.approvalStep)
    if (currentStep.role !== getContext()?.user?.role) {
      // TODO: keeping this check disabled in backend for now
      // throw new createError.BadRequest('User does not have the role required to perform this action')
    }

    if (request.action === 'reject') {
      // Delete the approval object from database
      await this.userRepository.deletePendingUserApproval(userId, id)

      return {
        entities: [
          {
            entityId: userId,
            entityType: 'USER',
            entitySubtype: 'USER_CHANGE_PROPOSAL',
            entityAction: 'UPDATE',
            oldImage: approval,
            newImage: { ...approval, approvalStatus: 'REJECTED' },
          },
        ],
        result: { ...approval, approvalStatus: 'REJECTED' },
      }
    }

    // Handle accept action - last step
    if (currentStep.isLastStep) {
      // Get the old user before updating
      const oldUser = await this.userRepository.getUser<
        UserWithRulesResult | BusinessWithRulesResult
      >(userId)
      if (!oldUser) {
        throw new createError.NotFound('User not found')
      }

      // Apply all the proposed changes using the reusable method
      await this.applyUserApprovalChanges(
        userId,
        oldUser,
        approval.proposedChanges
      )

      // Delete the approval object from database
      await this.userRepository.deletePendingUserApproval(userId, id)

      return {
        entities: [
          {
            entityId: userId,
            entityType: 'USER',
            entitySubtype: 'USER_CHANGE_PROPOSAL',
            entityAction: 'UPDATE',
            oldImage: approval,
            newImage: { ...approval, approvalStatus: 'APPROVED' },
          },
        ],
        result: { ...approval, approvalStatus: 'APPROVED' },
      }
    }

    // Handle accept action - not last step
    // Update the approval object with the next step
    const updatedApproval = {
      ...approval,
      approvalStep: approval.approvalStep + 1,
    }
    await this.userRepository.updatePendingUserApproval(updatedApproval)

    return {
      entities: [
        {
          entityId: userId,
          entityType: 'USER',
          entitySubtype: 'USER_CHANGE_PROPOSAL',
          entityAction: 'UPDATE',
          oldImage: approval,
          newImage: updatedApproval,
        },
      ],
      result: updatedApproval,
    }
  }

  public async getUserEntityChildUsers(
    request: DefaultApiGetUserEntityChildUsersRequest
  ) {
    const linkerService = new LinkerService(this.tenantId)
    const childUserIds = await linkerService.getChildUsers(request.userId)
    const userIds = [...childUserIds]
    if (isClickhouseEnabled()) {
      const result = await this.getClickhouseUsers({
        filterIds: userIds,
        page: request.page,
        pageSize: request.pageSize,
      })
      return result
    } else {
      const result = await this.getUsers({
        filterIds: userIds,
      })
      return result.result
    }
  }

  public async getUserEntityParentUser(userId: string) {
    const user = await this.userRepository.getParentUser(userId)
    return user ? [this.mapAllUserToTableItem(user)] : []
  }

  public async updatePendingUserApprovalsWorkflow(newWorkflowRef: {
    id: string
    version: number
  }): Promise<number> {
    return await this.userRepository.bulkUpdateUserApprovalsWorkflow(
      newWorkflowRef
    )
  }

  public async autoApplyPendingUserApprovals(
    fieldsWithRemovedWorkflows: string[]
  ): Promise<number> {
    console.log(
      `Auto-applying pending user approvals for fields: ${fieldsWithRemovedWorkflows.join(
        ', '
      )}`
    )

    // Get all pending user approvals
    const pendingApprovals =
      await this.userRepository.getAllPendingUserApprovals()

    // Filter approvals for the specified fields
    const approvalsToApply = pendingApprovals.filter((approval) =>
      approval.proposedChanges.some((change) =>
        fieldsWithRemovedWorkflows.includes(change.field)
      )
    )

    let appliedCount = 0

    // Auto-apply each pending approval
    for (const approval of approvalsToApply) {
      try {
        console.log(
          `Auto-applying user approval ${approval.id} for user ${approval.userId}`
        )

        // Get the user to apply changes to
        const user = await this.userRepository.getUser<
          UserWithRulesResult | BusinessWithRulesResult
        >(approval.userId)

        if (!user) {
          console.error(
            `User ${approval.userId} not found, skipping approval ${approval.id}`
          )
          continue
        }

        // Filter proposed changes to only include those for fields with removed workflows
        const changesToApply = approval.proposedChanges.filter((change) =>
          fieldsWithRemovedWorkflows.includes(change.field)
        )

        if (changesToApply.length > 0) {
          // Apply the changes using the reusable method that handles CRA, PepStatus, and other fields properly
          await this.applyUserApprovalChanges(
            approval.userId,
            user,
            changesToApply
          )
        }

        // Delete the approval object from database
        if (approval.id !== undefined) {
          await this.userRepository.deletePendingUserApproval(
            approval.userId,
            approval.id
          )
        }
        appliedCount++
      } catch (error) {
        console.error(
          `Failed to auto-apply user approval ${approval.id}:`,
          error
        )
        // Continue with other approvals even if one fails
      }
    }

    return appliedCount
  }
}
