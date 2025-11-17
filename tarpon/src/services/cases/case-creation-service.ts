import compact from 'lodash/compact'
import flatten from 'lodash/flatten'
import groupBy from 'lodash/groupBy'
import isEmpty from 'lodash/isEmpty'
import isEqual from 'lodash/isEqual'
import last from 'lodash/last'
import memoize from 'lodash/memoize'
import minBy from 'lodash/minBy'
import pick from 'lodash/pick'
import sample from 'lodash/sample'
import uniq from 'lodash/uniq'
import uniqBy from 'lodash/uniqBy'
import pluralize from 'pluralize'
import createHttpError from 'http-errors'
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb'
import { MongoClient } from 'mongodb'
import { SendMessageCommand } from '@aws-sdk/client-sqs'
import {
  APIGatewayEventLambdaAuthorizerContext,
  APIGatewayProxyWithLambdaAuthorizerEvent,
  Credentials as LambdaCredentials,
} from 'aws-lambda'
import { Credentials } from '@aws-sdk/client-sts'
import { S3 } from '@aws-sdk/client-s3'
import { backOff } from 'exponential-backoff'
import { filterLiveRules } from '../rules-engine/utils'
import { CounterRepository } from '../counter/repository'
import { AlertsService } from '../alerts'
import { S3Config } from '../aws/s3-service'
import { SLAPolicyService } from '../tenants/sla-policy-service'
import { SLAService } from '../sla/sla-service'
import { AccountsService } from '../accounts'
import {
  getPaymentDetailsNameString,
  getPaymentMethodAddress,
  getPaymentMethodId,
} from '../../utils/payment-details'
import { DynamoCaseRepository } from './dynamo-repository'
import { CaseService } from '.'
import { getSQSClient, getSQSQueueUrl } from '@/utils/sns-sqs-client'
import {
  CaseRepository,
  SubjectCasesQueryParams,
} from '@/services/cases/repository'
import {
  MAX_ALERTS_IN_A_CASE,
  MAX_TRANSACTION_IN_A_CASE,
  DEFAULT_CASE_AGGREGATES,
} from '@/constants/case-creation'
import { Case } from '@/@types/openapi-internal/Case'
import { Alert } from '@/@types/openapi-internal/Alert'
import { CaseCaseUsers } from '@/@types/openapi-internal/CaseCaseUsers'
import { UserRepository } from '@/services/users/repositories/user-repository'
import { RuleInstanceRepository } from '@/services/rules-engine/repositories/rule-instance-repository'
import { TransactionWithRulesResult } from '@/@types/openapi-public/TransactionWithRulesResult'
import { InternalConsumerUser } from '@/@types/openapi-internal/InternalConsumerUser'
import { InternalBusinessUser } from '@/@types/openapi-internal/InternalBusinessUser'
import { MongoDbTransactionRepository } from '@/services/rules-engine/repositories/mongodb-transaction-repository'
import { RuleHitDirection } from '@/@types/openapi-public/RuleHitDirection'
import { Priority } from '@/@types/openapi-public-management/Priority'
import { InternalTransaction } from '@/@types/openapi-internal/InternalTransaction'
import { logger } from '@/core/logger'
import { RuleInstance } from '@/@types/openapi-internal/RuleInstance'
import { HitRulesDetails } from '@/@types/openapi-internal/HitRulesDetails'
import { PRIORITYS } from '@/@types/openapi-internal-custom/Priority'
import {
  calculateCaseAvailableDate,
  getDerivedStatus,
} from '@/services/cases/utils'
import { getDefaultTimezone } from '@/utils/dayjs'
import { traceable } from '@/core/xray'
import { InternalUser } from '@/@types/openapi-internal/InternalUser'
import { ChecklistTemplatesService } from '@/services/tenants/checklist-template-service'
import { ChecklistTemplate } from '@/@types/openapi-internal/ChecklistTemplate'
import { ChecklistItemValue } from '@/@types/openapi-internal/ChecklistItemValue'
import { PaymentDetails } from '@/@types/tranasction/payment-type'
import { RoleService } from '@/services/roles'
import { AlertsRepository } from '@/services/alerts/repository'
import { FLAGRIGHT_SYSTEM_USER } from '@/utils/user'
import { Assignment } from '@/@types/openapi-internal/Assignment'
import { CaseAggregates } from '@/@types/openapi-internal/CaseAggregates'
import { generateCaseAggreates } from '@/utils/case'
import {
  hasFeature,
  tenantSettings,
  tenantTimezone,
} from '@/core/utils/context'
import { getContext } from '@/core/utils/context-storage'
import { generateChecksum, uniqObjects } from '@/utils/object'
import { CaseStatusChange } from '@/@types/openapi-internal/CaseStatusChange'
import { FileInfo } from '@/@types/openapi-internal/FileInfo'
import { Account } from '@/@types/openapi-internal/Account'
import { Comment } from '@/@types/openapi-internal/Comment'
import {
  ThinWebhookDeliveryTask,
  sendWebhookTasks,
} from '@/services/webhook/utils'
import { CaseOpenedDetails } from '@/@types/openapi-public/CaseOpenedDetails'
import { RuleHitMeta } from '@/@types/openapi-public/RuleHitMeta'
import { TenantRepository } from '@/services/tenants/repositories/tenant-repository'
import { NewCaseAlertPayload } from '@/@types/alert/alert-payload'
import { notNullish } from '@/utils/array'
import { getS3Client, getS3ClientByEvent } from '@/utils/s3'
import { CaseConfig } from '@/@types/cases/case-config'
import { SanctionsHitsRepository } from '@/services/sanctions/repositories/sanctions-hits-repository'
import { SanctionsSearchRepository } from '@/services/sanctions/repositories/sanctions-search-repository'
import { SLAPolicyDetails } from '@/@types/openapi-internal/SLAPolicyDetails'
import { SanctionsDetails } from '@/@types/openapi-public/SanctionsDetails'
import { getDefaultProviders } from '@/services/sanctions/utils'
import { acquireLock, releaseLock } from '@/utils/lock'
import { getDynamoDbClientByEvent } from '@/utils/dynamodb'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import { getCredentialsFromEvent } from '@/utils/credentials'
import { SLAPolicy } from '@/@types/openapi-internal/SLAPolicy'
import {
  auditLog,
  AuditLogEntity,
  AuditLogReturnData,
  getCaseAuditLogMetadata,
} from '@/utils/audit-log'
import { CaseSubject } from '@/@types/cases/CasesInternal'
import { isDemoTenant } from '@/utils/tenant-id'
import { CaseStatus } from '@/@types/openapi-internal/CaseStatus'
import { isConsoleMigrationEnabled } from '@/utils/clickhouse/checks'
import { SanctionsSearchHistory } from '@/@types/openapi-internal/SanctionsSearchHistory'
import { envIs } from '@/utils/env'
import { getPaymentEmailId } from '@/utils/payment-details'
import { Address } from '@/@types/openapi-public/Address'
import { AlertAlertMeta } from '@/@types/openapi-internal/AlertAlertMeta'

const RULEINSTANCE_SEPARATOR = '~$~'

const CASE_CREATION_PRIORITY: Record<CaseSubject['type'], number> = {
  USER: 0,
  PAYMENT: 1,
  NAME: 2,
  EMAIL: 3,
  ADDRESS: 4,
}

type CaseAuditLogReturnData = AuditLogReturnData<
  Case,
  { alerts: Alert[] | undefined },
  { alerts: Alert[] | undefined }
>

type ManualCaseAuditLogReturnData = AuditLogReturnData<
  Case,
  Case | Partial<Case>,
  Case | Partial<Case>
>

type NewCaseAuditLogReturnData = AuditLogReturnData<
  void,
  Case | Partial<Case>,
  Case | Partial<Case>
>

type ExtendedHitRulesDetails = HitRulesDetails & {
  compositeRuleInstanceId?: string
  originPaymentMethodId?: string
  destinationPaymentMethodId?: string
}

type CaseGroup = {
  subject: CaseSubject
  direction: RuleHitDirection
  ruleInstancesForGroup: RuleInstance[]
}

@traceable
export class CaseCreationService {
  caseRepository: CaseRepository
  userRepository: UserRepository
  dynamoCaseRepository: DynamoCaseRepository
  ruleInstanceRepository: RuleInstanceRepository
  transactionRepository: MongoDbTransactionRepository
  tenantId: string
  mongoDb: MongoClient
  dynamoDb: DynamoDBDocumentClient
  tenantRepository: TenantRepository
  sanctionsHitsRepository: SanctionsHitsRepository
  sanctionsSearchRepository: SanctionsSearchRepository
  caseService?: CaseService
  slaPolicyService: SLAPolicyService

  public static async fromEvent(
    event: APIGatewayProxyWithLambdaAuthorizerEvent<
      APIGatewayEventLambdaAuthorizerContext<Credentials>
    >
  ): Promise<CaseCreationService> {
    const { principalId: tenantId } = event.requestContext.authorizer
    const client = await getMongoDbClient()
    const dynamoDb = getDynamoDbClientByEvent(event)
    const { DOCUMENT_BUCKET, TMP_BUCKET } = process.env as CaseConfig
    const s3 = getS3ClientByEvent(event)
    return new CaseCreationService(
      tenantId,
      {
        mongoDb: client,
        dynamoDb,
      },
      s3,
      { documentBucketName: DOCUMENT_BUCKET, tmpBucketName: TMP_BUCKET },
      getCredentialsFromEvent(event)
    )
  }

  constructor(
    tenantID: string,
    connections: { dynamoDb: DynamoDBDocumentClient; mongoDb: MongoClient },
    s3?: S3,
    s3Config?: S3Config,
    awsCredentials?: LambdaCredentials
  ) {
    this.caseRepository = new CaseRepository(tenantID, connections)
    this.userRepository = new UserRepository(tenantID, connections)
    this.dynamoCaseRepository = new DynamoCaseRepository(
      tenantID,
      connections.dynamoDb
    )
    this.ruleInstanceRepository = new RuleInstanceRepository(
      tenantID,
      connections
    )
    this.transactionRepository = new MongoDbTransactionRepository(
      tenantID,
      connections.mongoDb,
      connections.dynamoDb
    )
    if (s3 && s3Config) {
      this.caseService = new CaseService(
        this.caseRepository,
        s3,
        s3Config,
        awsCredentials
      )
    }
    this.tenantId = tenantID
    this.mongoDb = connections.mongoDb
    this.dynamoDb = connections.dynamoDb
    this.tenantRepository = new TenantRepository(tenantID, connections)
    this.sanctionsSearchRepository = new SanctionsSearchRepository(tenantID, {
      mongoDb: connections.mongoDb,
      dynamoDb: connections.dynamoDb,
    })
    this.sanctionsHitsRepository = new SanctionsHitsRepository(
      tenantID,
      connections
    )
    this.slaPolicyService = new SLAPolicyService(tenantID, connections)
  }

  private tenantSettings = memoize(async () => {
    return await tenantSettings(this.tenantId)
  })

  private async sendCasesOpenedWebhook(cases: Case[]) {
    const webhookTasks: ThinWebhookDeliveryTask<CaseOpenedDetails>[] =
      cases.map((case_) => ({
        event: 'CASE_OPENED',
        triggeredBy: 'SYSTEM',
        entityId: case_.caseId as string,
        payload: {
          caseObject: case_,
          status: 'OPEN',
          userId:
            case_?.caseUsers?.origin?.userId ??
            case_?.caseUsers?.destination?.userId,
          transactionIds: case_?.caseTransactionsIds,
        },
      }))

    await sendWebhookTasks<CaseOpenedDetails>(this.tenantId, webhookTasks)
  }

  private getManualCaseComment(
    manualCaseData: CaseStatusChange,
    caseId: string,
    files: FileInfo[],
    transactionIds: string[]
  ): Comment {
    const { comment, reason, otherReason } = manualCaseData
    const { id: userId, email } = getContext()?.user as Account

    const transactionsCount = transactionIds.length

    // Break down string generation into smaller, more meaningful parts
    const createdByText = `Case ${caseId} is manually created by ${
      email ?? userId
    }`
    const reasonText = `with reason: ${reason}${
      reason?.[0] === 'Other' ? `: ${otherReason}` : ''
    }`

    // Individual components for transactionsText
    const transactionsCountText = `${transactionsCount} ${pluralize(
      'transaction',
      transactionsCount
    )}`

    const transactionIdsText = `${pluralize(
      'id',
      transactionsCount
    )} ${transactionIds.join(', ')}`

    // Final transactionsText based on the condition
    const transactionsText = transactionsCount
      ? ` and ${transactionsCountText} with ${transactionIdsText}`
      : ''

    const optionalComment = comment ? `\n${comment}` : ''

    const commentText = `${createdByText} ${reasonText}${transactionsText}${optionalComment}`

    return {
      body: commentText,
      createdAt: Date.now(),
      files,
      updatedAt: Date.now(),
      userId,
    }
  }

  @auditLog('CASE', 'MANUAL_CASE_CREATION', 'CREATE')
  public async createManualCaseFromUser(
    manualCaseData: CaseStatusChange,
    files: FileInfo[],
    transactionIds: string[],
    priority?: Priority
  ): Promise<ManualCaseAuditLogReturnData> {
    const { id: userId } = getContext()?.user as Account

    const caseUser = await this.userRepository.getUserById(
      manualCaseData.userId
    )

    if (!caseUser) {
      throw new createHttpError.NotFound(
        `User ${manualCaseData.userId} not found`
      )
    }

    const statusChange: CaseStatusChange = {
      ...manualCaseData,
      caseStatus: 'OPEN',
      userId,
    }

    const transactions = compact(transactionIds).length
      ? await this.transactionRepository.getTransactionsByIds(
          compact(transactionIds)
        )
      : []
    let slaPolicies: SLAPolicy[] = []
    if (hasFeature('PNB')) {
      slaPolicies = (
        await this.slaPolicyService.getSLAPolicies({
          type: 'MANUAL_CASE',
        })
      ).items
    }

    const auth0Domain =
      getContext()?.auth0Domain || (process.env.AUTH0_DOMAIN as string)
    const slaService = new SLAService(this.tenantId, auth0Domain, {
      mongoDb: this.mongoDb,
      dynamoDb: this.caseRepository.dynamoDb,
    })
    const now = Date.now()
    let case_: Case = {
      caseType: 'MANUAL',
      caseStatus: 'OPEN',
      caseUsers: {
        origin: caseUser,
        originUserRiskLevel:
          caseUser.drsScore?.manualRiskLevel ??
          caseUser.drsScore?.derivedRiskLevel,
        originUserDrsScore: caseUser.drsScore?.drsScore,
      },
      alerts: [],
      caseTransactionsCount: transactions.length,
      createdBy: manualCaseData.userId,
      priority: priority ?? 'P1',
      updatedAt: now,
      createdTimestamp: now,
      caseTransactionsIds: transactions.map((t) => t.transactionId),
      statusChanges: [statusChange],
      lastStatusChange: statusChange,
      caseAggregates: {
        originPaymentMethods: compact(
          uniq(transactions.map((t) => t.originPaymentDetails?.method))
        ),
        destinationPaymentMethods: compact(
          uniq(transactions.map((t) => t.destinationPaymentDetails?.method))
        ),
        tags: compact(
          uniqObjects(
            transactions
              .flatMap((t) => t.tags ?? [])
              .concat(caseUser.tags ?? [])
          )
        ),
      },
    }

    const slaPolicyDetails =
      slaPolicies.length > 0
        ? await Promise.all(
            slaPolicies.map(async (policy): Promise<SLAPolicyDetails> => {
              const slaDetail =
                await slaService.calculateSLAStatusForEntity<Case>(
                  case_,
                  policy.id,
                  'case'
                )
              return {
                slaPolicyId: policy.id,
                updatedAt: now,
                ...(slaDetail?.elapsedTime
                  ? {
                      policyStatus: slaDetail?.policyStatus,
                      elapsedTime: slaDetail?.elapsedTime,
                      startedAt: slaDetail?.startedAt,
                      timeToWarning: slaDetail?.timeToWarning,
                      timeToBreach: slaDetail?.timeToBreach,
                    }
                  : {}),
              }
            })
          )
        : undefined
    case_ = {
      ...case_,
      slaPolicyDetails,
    }
    await this.addOrUpdateCase(case_)
    if (!case_.caseId) {
      throw Error('Cannot find CaseId')
    }
    const comment = this.getManualCaseComment(
      manualCaseData,
      case_.caseId,
      files,
      transactions.map((t) => t.transactionId)
    )

    if (this.caseService) {
      await this.caseService.saveComment(case_.caseId, comment)
    } else {
      await this.caseRepository.saveComment(case_.caseId, comment)
    }

    return {
      result: case_,
      entities: [
        {
          entityId: case_.caseId ?? '-',
          newImage: case_,
          logMetadata: getCaseAuditLogMetadata(case_), // Removed case transactions to prevent sqs message size limit
        },
      ],
    }
  }

  private async addOrUpdateCase(caseEntity: Case): Promise<Case> {
    const isNew = caseEntity.caseId == null
    const case_ = await this.caseRepository.addCaseMongo(caseEntity)
    if (isNew) {
      await this.sendCasesOpenedWebhook([case_])
    }
    return case_
  }

  async getUsers(
    transaction: TransactionWithRulesResult
  ): Promise<(InternalConsumerUser | InternalBusinessUser)[]> {
    const userIds = new Set<string>()
    if (transaction.originUserId) {
      userIds.add(transaction.originUserId)
    }
    if (transaction.destinationUserId) {
      userIds.add(transaction.destinationUserId)
    }
    if (userIds.size) {
      return await this.userRepository.getMongoUsersByIds([...userIds])
    } else {
      return []
    }
  }

  private async getUser(
    userId: string | undefined
  ): Promise<InternalUser | null> {
    if (userId == null) {
      return null
    }
    const user = await this.userRepository.getMongoUser(userId)
    // Do not use MissingUser wrapper to prevent case creation for missing users. Discussion: https://www.notion.so/flagright/Hide-cases-for-unknown-user-IDs-for-Kevin-3052119fc63c48058d6100d0de12bb29
    if (user == null || !('type' in user)) {
      return null
    }
    return user
  }

  public async getTransactionSubjects(
    transaction: TransactionWithRulesResult
  ): Promise<Record<RuleHitDirection, CaseSubject[] | undefined>> {
    const {
      originUserId,
      destinationUserId,
      originPaymentDetails,
      destinationPaymentDetails,
    } = transaction

    // If the origin user and the destination user are the same, we can pass undefined for the destination user
    const isAnyRuleHasOriginHit = transaction?.hitRules?.some(
      (hitRule) =>
        hitRule.ruleHitMeta?.hitDirections?.includes('ORIGIN') ?? false
    )

    logger.debug(`Fetching case users by ids`, {
      destinationUserId,
      originUserId,
    })

    const origin: CaseSubject[] = []
    const originAddress: Address | undefined =
      getPaymentMethodAddress(originPaymentDetails)
    const originEmail: string | undefined =
      getPaymentEmailId(originPaymentDetails)
    const originName: string | undefined =
      getPaymentDetailsNameString(originPaymentDetails)

    if (isAnyRuleHasOriginHit) {
      if (originUserId) {
        const user = await this.getUser(originUserId)
        if (user != null) {
          origin.push({ type: 'USER', user: user })
        }
      }
      if (originPaymentDetails != null) {
        origin.push({ type: 'PAYMENT', paymentDetails: originPaymentDetails })
      }

      if (originAddress != null) {
        origin.push({ type: 'ADDRESS', address: originAddress })
      }

      if (originEmail != null) {
        origin.push({ type: 'EMAIL', email: originEmail })
      }

      if (originName != null) {
        origin.push({ type: 'NAME', name: originName })
      }
    }
    const destination: CaseSubject[] = []
    {
      if (destinationUserId) {
        if (!(isAnyRuleHasOriginHit && originUserId === destinationUserId)) {
          const user = await this.getUser(destinationUserId)
          if (user != null) {
            destination.push({ type: 'USER', user: user })
          }
        }
      }

      if (
        !(
          isAnyRuleHasOriginHit &&
          isEqual(destinationPaymentDetails, originPaymentDetails)
        )
      ) {
        if (destinationPaymentDetails != null) {
          destination.push({
            type: 'PAYMENT',
            paymentDetails: destinationPaymentDetails,
          })
        }
      }
      const destinationAddress: Address | undefined = getPaymentMethodAddress(
        destinationPaymentDetails
      )
      const destinationEmail: string | undefined = getPaymentEmailId(
        destinationPaymentDetails
      )
      const destinationName: string | undefined = getPaymentDetailsNameString(
        destinationPaymentDetails
      )

      if (
        !(isAnyRuleHasOriginHit && isEqual(originAddress, destinationAddress))
      ) {
        if (destinationAddress != null) {
          destination.push({ type: 'ADDRESS', address: destinationAddress })
        }
      }

      if (!(isAnyRuleHasOriginHit && isEqual(originEmail, destinationEmail))) {
        if (destinationEmail != null) {
          destination.push({ type: 'EMAIL', email: destinationEmail })
        }
      }

      if (!(isAnyRuleHasOriginHit && isEqual(originName, destinationName))) {
        if (destinationName != null) {
          destination.push({ type: 'NAME', name: destinationName })
        }
      }
    }

    return {
      ORIGIN: origin,
      DESTINATION: destination,
    }
  }

  public async separateExistingAndNewAlerts(
    hitRules: ExtendedHitRulesDetails[],
    ruleInstances: readonly RuleInstance[],
    alerts: Alert[],
    createdTimestamp: number,
    latestTransactionArrivalTimestamp?: number,
    transaction?: InternalTransaction,
    checkListTemplates?: ChecklistTemplate[]
  ): Promise<{ existingAlerts: Alert[]; newAlerts: Alert[] }> {
    // Get the rule hits that are new for this transaction
    const newRuleHits = hitRules.filter(
      (hitRule) =>
        !alerts.some((alert) =>
          this.shouldNotCreateNewAlert(alert, hitRule, ruleInstances)
        )
    )

    // Get the alerts that are new for this transaction
    const newAlerts =
      newRuleHits.length > 0
        ? await this.getAlertsForNewCase(
            newRuleHits,
            ruleInstances,
            createdTimestamp,
            latestTransactionArrivalTimestamp,
            transaction,
            checkListTemplates
          )
        : []

    // Get the alerts that already existed on the case
    const existingAlerts = alerts.filter(
      (existingAlert) =>
        !newRuleHits.some((newRuleHits) =>
          this.shouldNotCreateNewAlert(
            existingAlert,
            newRuleHits,
            ruleInstances
          )
        )
    )

    return {
      existingAlerts,
      newAlerts,
    }
  }

  private async getOrCreateAlertsForExistingCase(
    hitRules: ExtendedHitRulesDetails[],
    alerts: Alert[] | undefined,
    ruleInstances: readonly RuleInstance[],
    createdTimestamp: number,
    latestTransaction?: InternalTransaction,
    latestTransactionArrivalTimestamp?: number,
    checkListTemplates?: ChecklistTemplate[]
  ): Promise<Alert[]> {
    if (alerts) {
      const { existingAlerts, newAlerts } =
        await this.separateExistingAndNewAlerts(
          hitRules,
          ruleInstances,
          alerts,
          createdTimestamp,
          latestTransactionArrivalTimestamp,
          latestTransaction,
          checkListTemplates
        )

      const updatedExistingAlerts =
        existingAlerts.length > 0
          ? await this.updateExistingAlerts(
              existingAlerts,
              latestTransaction,
              latestTransactionArrivalTimestamp,
              ruleInstances,
              checkListTemplates,
              hitRules
            )
          : []

      return [...updatedExistingAlerts, ...newAlerts]
    } else {
      return this.getAlertsForNewCase(
        hitRules,
        ruleInstances,
        createdTimestamp,
        latestTransactionArrivalTimestamp,
        latestTransaction,
        checkListTemplates
      )
    }
  }

  private async getAlertsForNewCase(
    hitRules: ExtendedHitRulesDetails[],
    ruleInstances: readonly RuleInstance[],
    createdTimestamp: number,
    latestTransactionArrivalTimestamp?: number,
    transaction?: InternalTransaction,
    checkListTemplates?: ChecklistTemplate[]
  ): Promise<Alert[]> {
    const counterRepository = new CounterRepository(this.tenantId, {
      mongoDb: this.mongoDb,
      dynamoDb: this.caseRepository.dynamoDb,
    })

    const alerts: (Alert | null)[] = await Promise.all(
      hitRules.map(
        async (hitRule: ExtendedHitRulesDetails): Promise<Alert | null> => {
          const ruleInstanceMatch: RuleInstance | null =
            ruleInstances.find(
              (ruleInstance) => hitRule.ruleInstanceId === ruleInstance.id
            ) ?? null

          const now = Date.now()
          const availableAfterTimestamp: number | undefined =
            ruleInstanceMatch?.alertConfig?.alertCreationInterval != null
              ? calculateCaseAvailableDate(
                  now,
                  ruleInstanceMatch?.alertConfig?.alertCreationInterval,
                  (await this.tenantSettings())?.defaultValues
                    ?.tenantTimezone ?? getDefaultTimezone()
                )
              : undefined
          const ruleChecklist = checkListTemplates?.find(
            (x) => x.id === ruleInstanceMatch?.checklistTemplateId
          )
          const assignee = await this.getRuleAlertAssignee(
            ruleInstanceMatch?.alertConfig?.alertAssignees,
            ruleInstanceMatch?.alertConfig?.alertAssigneeRole
          )
          const alertCount = await counterRepository.getNextCounterAndUpdate(
            'Alert'
          )
          const updatedRuleHitMeta =
            hitRule.ruleHitMeta != null
              ? await this.addOrUpdateSanctionsHits(hitRule.ruleHitMeta, false)
              : undefined
          const auth0Domain =
            getContext()?.auth0Domain || (process.env.AUTH0_DOMAIN as string)
          const slaService = new SLAService(this.tenantId, auth0Domain, {
            mongoDb: this.mongoDb,
            dynamoDb: this.caseRepository.dynamoDb,
          })
          const newAlertStatus =
            ruleInstanceMatch?.alertConfig?.defaultAlertStatus ?? 'OPEN'
          const statusChange =
            newAlertStatus !== 'OPEN'
              ? ({
                  userId: FLAGRIGHT_SYSTEM_USER,
                  reason: ['Other'],
                  timestamp: now,
                  caseStatus: newAlertStatus,
                  otherReason: 'Status set by rule',
                  comment: `Alert default status set to '${newAlertStatus}' by rule configuration`,
                } as CaseStatusChange)
              : undefined

          let alertMeta: AlertAlertMeta | undefined = undefined

          if (hitRule.destinationPaymentMethodId) {
            alertMeta = {
              ...(alertMeta ?? {}),
              destinationPaymentMethodId: hitRule.destinationPaymentMethodId,
            }
          }
          if (hitRule.originPaymentMethodId) {
            alertMeta = {
              ...(alertMeta ?? {}),
              originPaymentMethodId: hitRule.originPaymentMethodId,
            }
          }

          const newAlert: Alert = {
            _id: alertCount,
            alertId: `A-${alertCount}`,
            createdTimestamp: availableAfterTimestamp ?? createdTimestamp,
            latestTransactionArrivalTimestamp,
            updatedAt: now,
            alertStatus: newAlertStatus,
            ruleId: hitRule.ruleId,
            availableAfterTimestamp: availableAfterTimestamp,
            ruleInstanceId: hitRule.ruleInstanceId,
            ruleName: hitRule.ruleName,
            ruleDescription: hitRule.ruleDescription,
            ruleAction: hitRule.ruleAction,
            ruleHitMeta: updatedRuleHitMeta,
            ruleNature: hitRule.nature,
            ruleQueueId: ruleInstanceMatch?.queueId,
            numberOfTransactionsHit: transaction ? 1 : 0,
            transactionIds: transaction ? [transaction.transactionId] : [],
            priority: (ruleInstanceMatch?.casePriority ??
              last(PRIORITYS)) as Priority,
            lastStatusChange: statusChange,
            statusChanges: statusChange ? [statusChange] : [],
            originPaymentMethods: transaction?.originPaymentDetails?.method
              ? [transaction?.originPaymentDetails?.method]
              : [],
            destinationPaymentMethods: transaction?.destinationPaymentDetails
              ?.method
              ? [transaction?.destinationPaymentDetails?.method]
              : [],
            comments: statusChange
              ? [
                  {
                    body: statusChange.comment as string,
                    createdAt: statusChange.timestamp,
                    userId: FLAGRIGHT_SYSTEM_USER,
                  },
                ]
              : [],
            ruleChecklistTemplateId: ruleInstanceMatch?.checklistTemplateId,
            ruleChecklist: ruleChecklist?.categories.flatMap(
              (category) =>
                category.checklistItems.map(
                  (item) =>
                    ({
                      checklistItemId: item.id,
                      done: 'NOT_STARTED',
                    } as ChecklistItemValue)
                ) ?? []
            ),
            assignments: assignee ? [assignee] : [],
            alertMeta,
          }
          const slaPolicyDetails: SLAPolicyDetails[] = await Promise.all(
            ruleInstanceMatch?.alertConfig?.slaPolicies?.map(async (id) => {
              const slaDetail =
                await slaService.calculateSLAStatusForEntity<Alert>(
                  newAlert,
                  id,
                  'alert'
                )
              return {
                slaPolicyId: id,
                updatedAt: now,
                ...(slaDetail?.elapsedTime
                  ? {
                      elapsedTime: slaDetail?.elapsedTime,
                      policyStatus: slaDetail?.policyStatus,
                      startedAt: slaDetail?.startedAt,
                      timeToWarning: slaDetail?.timeToWarning,
                      timeToBreach: slaDetail?.timeToBreach,
                    }
                  : {}),
              }
            }) || []
          )
          return {
            ...newAlert,
            slaPolicyDetails,
          }
        }
      )
    )

    return compact(alerts)
  }

  private async updateExistingAlerts(
    alerts: Alert[],
    transaction?: InternalTransaction,
    latestTransactionArrivalTimestamp?: number,
    ruleInstances?: readonly RuleInstance[],
    checkListTemplates?: ChecklistTemplate[],
    hitRules?: HitRulesDetails[]
  ): Promise<Alert[]> {
    return Promise.all(
      alerts.map(async (alert) => {
        if (!transaction || !latestTransactionArrivalTimestamp) {
          return alert
        }

        const ruleInstanceMatch: RuleInstance | null =
          ruleInstances?.find(
            (ruleInstance) => alert.ruleInstanceId === ruleInstance.id
          ) ?? null

        const transactionBelongsToAlert = Boolean(
          transaction.hitRules.find((rule) =>
            this.shouldNotCreateNewAlert(alert, rule, ruleInstances ?? [])
          )
        )
        if (!transactionBelongsToAlert) {
          return alert
        }

        const txnSet = new Set(alert.transactionIds).add(
          transaction.transactionId
        )
        const originPaymentDetails = new Set(alert.originPaymentMethods)
        const destinationPaymentDetails = new Set(
          alert.destinationPaymentMethods
        )
        if (transaction.originPaymentDetails?.method) {
          originPaymentDetails.add(transaction.originPaymentDetails.method)
        }
        if (transaction.destinationPaymentDetails?.method) {
          destinationPaymentDetails.add(
            transaction.destinationPaymentDetails.method
          )
        }

        const sanctionsDetails = (hitRules ?? [])
          .filter((hit) => alert.ruleInstanceId === hit.ruleInstanceId)
          .flatMap((hit) => hit.ruleHitMeta?.sanctionsDetails ?? [])

        let updatedRuleHitMeta =
          sanctionsDetails.length > 0
            ? {
                ...alert.ruleHitMeta,
                sanctionsDetails: (() => {
                  return uniqBy(
                    [
                      ...(alert?.ruleHitMeta?.sanctionsDetails ?? []),
                      ...(sanctionsDetails ?? []),
                    ],
                    (item) =>
                      `${item.searchId}_${
                        item.hitContext?.paymentMethodId || 'unknown'
                      }_${item.entityType}`
                  )
                })(),
              }
            : alert.ruleHitMeta

        updatedRuleHitMeta =
          updatedRuleHitMeta != null
            ? await this.addOrUpdateSanctionsHits(updatedRuleHitMeta, true)
            : undefined

        return {
          ...alert,
          latestTransactionArrivalTimestamp: latestTransactionArrivalTimestamp,
          transactionIds: Array.from(txnSet),
          originPaymentMethods: Array.from(originPaymentDetails),
          destinationPaymentMethods: Array.from(destinationPaymentDetails),
          numberOfTransactionsHit: txnSet.size,
          updatedAt: Date.now(),
          ruleHitMeta: updatedRuleHitMeta,
          ruleChecklistTemplateId:
            alert?.ruleChecklistTemplateId ??
            ruleInstanceMatch?.checklistTemplateId,
          ruleChecklist:
            alert?.ruleChecklist ??
            checkListTemplates?.flatMap((template) =>
              template.categories.flatMap((category) =>
                category.checklistItems.map(
                  (item) =>
                    ({
                      checklistItemId: item.id,
                      done: 'NOT_STARTED',
                    } as ChecklistItemValue)
                )
              )
            ),
        }
      })
    )
  }

  private async addOrUpdateSanctionsHits(
    ruleHitMeta: RuleHitMeta,
    update: boolean
  ): Promise<RuleHitMeta> {
    const sanctionsDetailsList = ruleHitMeta?.sanctionsDetails ?? []
    const defaultProvider = getDefaultProviders()?.[0]
    const updatedSanctionsDetailsList = await Promise.all(
      sanctionsDetailsList.map(
        async (sanctionsDetail): Promise<SanctionsDetails | undefined> => {
          let searchResult =
            await this.sanctionsSearchRepository.getSearchResult(
              sanctionsDetail.searchId
            )
          try {
            if (
              !searchResult &&
              envIs('sandbox', 'prod') &&
              !isDemoTenant(this.tenantId)
            ) {
              // When the sanctions search is not updated in mongo via queue, we need to retry to fetch the search result
              searchResult = await backOff<SanctionsSearchHistory>(
                async () => {
                  const result =
                    await this.sanctionsSearchRepository.getSearchResult(
                      sanctionsDetail.searchId
                    )
                  if (!result) {
                    throw new Error(
                      `Search result not found for searchId: ${sanctionsDetail.searchId}`
                    )
                  }
                  return result
                },
                {
                  startingDelay: 1000,
                  timeMultiple: 1,
                  maxDelay: 1000,
                  numOfAttempts: 4,
                  delayFirstAttempt: true,
                }
              )
            }
          } catch (_e) {
            logger.warn(
              `Search Not found for searchId: ${sanctionsDetail.searchId}`
            )
          }
          const rawHits =
            (
              await this.sanctionsSearchRepository.hydrateLSEGApiSearchResults(
                searchResult
              )
            )?.response?.data ?? []
          if (update) {
            const { updatedIds, newIds } =
              await this.sanctionsHitsRepository.mergeHits(
                searchResult?.provider || defaultProvider,
                sanctionsDetail.searchId,
                rawHits,
                sanctionsDetail.hitContext
              )
            return {
              ...sanctionsDetail,
              sanctionHitIds: [...updatedIds, ...newIds],
            }
          } else {
            const hits = await this.sanctionsHitsRepository.addHits(
              searchResult?.provider || defaultProvider,
              sanctionsDetail.searchId,
              rawHits,
              sanctionsDetail.hitContext
            )
            return {
              ...sanctionsDetail,
              sanctionHitIds: hits.map((x) => x.sanctionsHitId) || [],
            }
          }
        }
      )
    )

    return updatedSanctionsDetailsList.length > 0
      ? {
          ...ruleHitMeta,
          sanctionsDetails: updatedSanctionsDetailsList.filter(
            (sd): sd is SanctionsDetails => Boolean(sd)
          ),
        }
      : ruleHitMeta
  }

  private createCaseEntity<T>(
    subjectType: CaseSubject['type'],
    direction: RuleHitDirection,
    value: T,
    status: CaseStatus = 'OPEN'
  ): Case {
    const keyMap: Record<CaseSubject['type'], string> = {
      USER: 'caseUsers',
      ADDRESS: 'address',
      EMAIL: 'email',
      NAME: 'name',
      PAYMENT: 'paymentDetails',
    }

    const key = keyMap[subjectType]
    const directionValue = {
      origin: direction === 'ORIGIN' ? value : undefined,
      destination: direction === 'DESTINATION' ? value : undefined,
    }

    return {
      caseStatus: status,
      caseType: 'SYSTEM',
      subjectType,
      [key]: directionValue,
      caseAggregates: DEFAULT_CASE_AGGREGATES,
    }
  }

  private getNewUserCase(
    direction: RuleHitDirection,
    user: InternalConsumerUser | InternalBusinessUser,
    status: CaseStatus = 'OPEN'
  ): Case {
    return this.createCaseEntity('USER', direction, user, status)
  }

  private getNewAddressCase(
    direction: RuleHitDirection,
    address: Address,
    status: CaseStatus = 'OPEN'
  ): Case {
    return this.createCaseEntity('ADDRESS', direction, address, status)
  }

  private getNewEmailCase(
    direction: RuleHitDirection,
    email: string,
    status: CaseStatus = 'OPEN'
  ): Case {
    return this.createCaseEntity('EMAIL', direction, email, status)
  }

  private getNewNameCase(
    direction: RuleHitDirection,
    name: string,
    status: CaseStatus = 'OPEN'
  ): Case {
    return this.createCaseEntity('NAME', direction, name, status)
  }

  private getNewPaymentCase(
    direction: RuleHitDirection,
    paymentDetails: PaymentDetails,
    status: CaseStatus = 'OPEN'
  ): Case {
    return this.createCaseEntity('PAYMENT', direction, paymentDetails, status)
  }

  private getCaseAggregates(
    transactions: InternalTransaction[],
    caseUsers?: CaseCaseUsers
  ): CaseAggregates {
    const originPaymentMethods = uniq(
      compact(
        transactions.flatMap(
          ({ originPaymentDetails }) => originPaymentDetails?.method ?? []
        )
      )
    )
    const destinationPaymentMethods = uniq(
      compact(
        transactions.flatMap(
          ({ destinationPaymentDetails }) =>
            destinationPaymentDetails?.method ?? []
        )
      )
    )

    // Collect transaction tags
    const transactionTags = compact(
      transactions.flatMap(({ tags }) => tags ?? [])
    )

    // Collect user tags from case users
    const userTags: Array<{ key: string; value: string }> = []
    if (
      caseUsers?.origin &&
      'tags' in caseUsers.origin &&
      caseUsers.origin.tags
    ) {
      userTags.push(...caseUsers.origin.tags)
    }
    if (
      caseUsers?.destination &&
      'tags' in caseUsers.destination &&
      caseUsers.destination.tags
    ) {
      userTags.push(...caseUsers.destination.tags)
    }

    // Combine transaction tags and user tags
    const tags = uniqObjects(transactionTags.concat(userTags)).sort()

    return {
      originPaymentMethods,
      destinationPaymentMethods,
      tags,
    }
  }

  @auditLog('CASE', 'CREATION', 'CREATE')
  public async createNewCaseFromAlerts(
    sourceCase: Case,
    alertIds: string[]
  ): Promise<CaseAuditLogReturnData> {
    // Extract all alerts transactions
    const sourceAlerts = sourceCase.alerts ?? []
    const allAlertsTransactionIds: string[] = sourceAlerts
      .flatMap(({ transactionIds }) => transactionIds)
      .filter((id: string | undefined): id is string => id != null)
    const { data: allAlertsTransactions } =
      await this.transactionRepository.getTransactions({
        filterTransactionIds: allAlertsTransactionIds,
        afterTimestamp: 0,
        beforeTimestamp: Number.MAX_SAFE_INTEGER,
        pageSize: 'DISABLED',
      })

    // Split alerts which goes to new case and alerts which stay in the old one
    const predicate = (x: Alert) =>
      x.alertId != null && alertIds.includes(x.alertId)
    const newCaseAlerts = sourceAlerts.filter(predicate)
    const oldCaseAlerts = sourceAlerts.filter((x) => !predicate(x))

    // Split transactions
    const newCaseAlertsTransactionsIds =
      newCaseAlerts.flatMap(({ transactionIds }) => transactionIds) ?? []
    const transactionPredicate = (transaction: InternalTransaction) => {
      return newCaseAlertsTransactionsIds.includes(transaction.transactionId)
    }
    const newCaseAlertsTransactions =
      allAlertsTransactions.filter(transactionPredicate)
    const oldCaseAlertsTransactions = allAlertsTransactions.filter(
      (x) => !transactionPredicate(x)
    )

    const caseTransactionsIds = uniq(
      newCaseAlertsTransactions.map(({ transactionId }) => transactionId)
    )

    const now = Date.now()

    // Delete alert data from parent case
    await this.dynamoCaseRepository.deleteCaseAlertData(
      sourceCase.caseId ?? '',
      newCaseAlerts.map((alert) => alert.alertId ?? '')
    )

    // Create new case
    const newCase = await this.addOrUpdateCase({
      alerts: newCaseAlerts,
      createdTimestamp: now,
      caseStatus: 'OPEN',
      caseType: 'SYSTEM',
      subjectType: sourceCase.subjectType,
      paymentDetails: sourceCase.paymentDetails,
      priority: minBy(newCaseAlerts, 'priority')?.priority ?? last(PRIORITYS),
      relatedCases: sourceCase.caseId
        ? [...(sourceCase.relatedCases ?? []), sourceCase.caseId]
        : sourceCase.relatedCases,
      caseUsers: sourceCase.caseUsers,
      caseTransactionsIds,
      caseTransactionsCount: caseTransactionsIds.length,
      updatedAt: now,
      caseAggregates: this.getCaseAggregates(
        newCaseAlertsTransactions ?? [],
        sourceCase.caseUsers
      ),
    })

    const oldCaseTransactionsIds = uniq(
      oldCaseAlertsTransactions.map(({ transactionId }) => transactionId)
    )

    await this.addOrUpdateCase({
      ...sourceCase,
      alerts: oldCaseAlerts,
      caseTransactionsIds: oldCaseTransactionsIds,
      caseTransactionsCount: oldCaseTransactionsIds.length,
      priority: minBy(oldCaseAlerts, 'priority')?.priority ?? last(PRIORITYS),
      updatedAt: now,
      caseAggregates: this.getCaseAggregates(
        oldCaseAlertsTransactions ?? [],
        sourceCase.caseUsers
      ),
    })

    return {
      result: newCase,
      entities: [
        {
          entityId: sourceCase.caseId as string,
          oldImage: { alerts: sourceCase.alerts },
          newImage: { alerts: newCase.alerts },
        },
        {
          entityId: sourceCase.caseId as string,
          newImage: { alerts: sourceCase.alerts },
          oldImage: { alerts: newCase.alerts },
          entityAction: 'UPDATE',
        },
      ],
    }
  }

  private async getCheckListTemplates(
    ruleInstances: readonly RuleInstance[],
    hitRules: HitRulesDetails[]
  ): Promise<ChecklistTemplate[]> {
    const checklistTemplatesService = new ChecklistTemplatesService(
      this.tenantId,
      this.mongoDb
    )

    const checkListTemplateIds = uniq(
      compact(
        ruleInstances
          .filter((x) => hitRules.some((y) => y.ruleInstanceId === x.id))
          .map((x) => x.checklistTemplateId)
      )
    )

    if (checkListTemplateIds.length === 0) {
      return []
    }

    const checkListTemplates =
      await checklistTemplatesService.getChecklistTemplateByIds(
        checkListTemplateIds
      )

    return checkListTemplates
  }

  private generateCompositeRuleInstanceId(
    ruleInstanceId: string,
    searchTerm: string
  ): string {
    return `${ruleInstanceId}${RULEINSTANCE_SEPARATOR}${searchTerm}`
  }

  public async getCasesBySubject(
    subject: CaseSubject,
    params: SubjectCasesQueryParams
  ): Promise<Case[]> {
    if (isConsoleMigrationEnabled()) {
      return this.dynamoCaseRepository.getCasesBySubject(subject, params)
    }

    switch (subject.type) {
      case 'USER':
        return this.caseRepository.getCasesByUserId(subject.user.userId, params)
      case 'PAYMENT':
        return this.caseRepository.getCasesByPaymentDetails(
          subject.paymentDetails,
          params
        )
      case 'ADDRESS':
        return this.caseRepository.getCasesByAddress(subject.address, params)
      case 'EMAIL':
        return this.caseRepository.getCasesByEmail(subject.email, params)
      case 'NAME':
        return this.caseRepository.getCasesByName(subject.name, params)
    }
  }

  private flattenHitRules(
    hitRules: HitRulesDetails[],
    ruleInstances: readonly RuleInstance[],
    transaction?: InternalTransaction
  ): ExtendedHitRulesDetails[] {
    return hitRules.flatMap((hitRule) => {
      const ruleInstance = ruleInstances.find(
        (ruleInstance) => ruleInstance.id === hitRule.ruleInstanceId
      )

      if (
        ruleInstance?.screeningAlertCreationLogic === 'PER_SEARCH_ALERT' ||
        ruleInstance?.alertCreationLogic === 'PER_COUNTERPARTY_ALERT'
      ) {
        if (hitRule.ruleHitMeta?.sanctionsDetails?.length) {
          return (
            hitRule.ruleHitMeta?.sanctionsDetails?.map((x) => {
              return {
                ...hitRule,
                compositeRuleInstanceId: this.generateCompositeRuleInstanceId(
                  hitRule.ruleInstanceId,
                  x.hitContext?.searchTerm ?? ''
                ),
                ruleHitMeta: {
                  ...hitRule.ruleHitMeta,
                  sanctionsDetails: [x],
                },
              }
            }) ?? []
          )
        } else if (transaction) {
          const originPaymentMethodId = getPaymentMethodId(
            transaction.originPaymentDetails
          )
          const destinationPaymentMethodId = getPaymentMethodId(
            transaction.destinationPaymentDetails
          )
          const extendedHitRule: ExtendedHitRulesDetails[] = []
          if (
            hitRule.ruleHitMeta?.hitDirections?.includes('ORIGIN') &&
            destinationPaymentMethodId
          ) {
            extendedHitRule.push({
              ...hitRule,
              ruleHitMeta: {
                ...hitRule.ruleHitMeta,
                hitDirections: ['ORIGIN'],
              },
              // then create new alert based on counterparty which will be destination payment method id
              destinationPaymentMethodId: destinationPaymentMethodId,
            })
          }
          if (
            hitRule.ruleHitMeta?.hitDirections?.includes('DESTINATION') &&
            originPaymentMethodId
          ) {
            extendedHitRule.push({
              ...hitRule,

              // then create new alert based on counterparty which will be origin payment method id
              originPaymentMethodId: originPaymentMethodId,
              ruleHitMeta: {
                ...hitRule.ruleHitMeta,
                hitDirections: ['DESTINATION'],
              },
            })
          }
          return extendedHitRule
        }
        return [hitRule]
      }

      return [hitRule]
    })
  }

  private sanitizeHitRules(
    hitRules: HitRulesDetails[],
    direction: RuleHitDirection
  ) {
    return compact(
      hitRules.map((rule) => {
        if (rule.ruleId === 'R-170') {
          const updatedRule = {
            ...rule,
            ruleHitMeta: {
              ...rule.ruleHitMeta,
              hitDirections: rule.ruleHitMeta?.hitDirections?.filter(
                (hitDirection) => hitDirection === direction
              ),
              sanctionsDetails: rule.ruleHitMeta?.sanctionsDetails?.filter(
                (detail) => detail.hitDirection === direction
              ),
            },
          }
          if (updatedRule.ruleHitMeta?.sanctionsDetails?.length === 0) {
            return undefined
          }
          return updatedRule
        }
        return rule
      })
    )
  }

  /**
   * Creates or updates cases based on rule hits and subjects.
   *
   * This method handles the complex logic of:
   * 1. Grouping hit subjects by direction to ensure one case per direction
   * 2. Selecting the highest priority subject type for each direction
   * 3. Creating new cases or updating existing ones with new alerts
   * 4. Managing case aggregation and transaction tracking
   *
   * @param hitSubjects - Array of subjects that hit rules with their directions
   * @param params - Parameters including timestamps, priority, transaction, and hit rules
   * @param hitRuleInstances - Rule instances that were hit
   * @returns Promise<Case[]> - Array of created or updated cases
   */
  private async getOrCreateCases(
    hitSubjects: Array<{
      subject: CaseSubject
      direction: RuleHitDirection
    }>,
    params: {
      createdTimestamp: number
      latestTransactionArrivalTimestamp?: number
      priority: Priority
      transaction?: InternalTransaction
      hitRules: HitRulesDetails[]
      checkListTemplates?: ChecklistTemplate[]
    },
    hitRuleInstances: ReadonlyArray<RuleInstance>
  ): Promise<Case[]> {
    logger.debug(`Hit directions to create or update cases`, {
      hitDirections: hitSubjects.map((hitUser) => hitUser.direction),
    })

    // Filter rule instances that allow alert creation
    const ruleInstances = hitRuleInstances.filter(
      (r) => r.alertCreationOnHit !== false
    )

    // Flatten hit rules to handle composite rule instances (e.g., R-169, R-170 for counterparties)
    const flattenedHitRules: ExtendedHitRulesDetails[] = this.flattenHitRules(
      params.hitRules,
      ruleInstances,
      params.transaction
    )

    // Group subjects by direction and alertCreatedFor configuration
    const caseGroups = this.createCaseGroups(
      hitSubjects,
      flattenedHitRules,
      ruleInstances
    )

    const result: Case[] = []

    // Process each case group
    for (const caseGroup of caseGroups) {
      const { subject, direction, ruleInstancesForGroup } = caseGroup

      // Acquire lock to prevent concurrent case creation for the same subject
      await acquireLock(this.dynamoDb, generateChecksum(subject), {
        startingDelay: 100,
        maxDelay: 5000,
      })

      try {
        const casesForGroup = await this.processCasesForDirection(
          subject,
          direction,
          ruleInstancesForGroup,
          flattenedHitRules,
          params
        )
        result.push(...casesForGroup)
      } finally {
        await releaseLock(this.dynamoDb, generateChecksum(subject))
      }
    }

    return result
  }

  /**
   * Creates case groups by combining direction and alertCreatedFor configuration.
   * Each group represents a unique combination that needs a separate case.
   */
  private createCaseGroups(
    hitSubjects: Array<{ subject: CaseSubject; direction: RuleHitDirection }>,
    flattenedHitRules: ExtendedHitRulesDetails[],
    ruleInstances: ReadonlyArray<RuleInstance>
  ): CaseGroup[] {
    const caseGroups: CaseGroup[] = []

    // Group by direction first
    const subjectsByDirection = new Map<RuleHitDirection, CaseSubject[]>()
    for (const { subject, direction } of hitSubjects) {
      if (!subjectsByDirection.has(direction)) {
        subjectsByDirection.set(direction, [])
      }
      subjectsByDirection.get(direction)?.push(subject)
    }

    // For each direction, create groups based on alertCreatedFor
    for (const [direction, subjects] of subjectsByDirection) {
      const directionRuleInstances = this.getRuleInstancesForDirection(
        ruleInstances,
        flattenedHitRules,
        direction
      )

      // Group rule instances by alertCreatedFor configuration
      const ruleGroupsByAlertCreatedFor =
        this.groupRuleInstancesByAlertCreatedFor(directionRuleInstances)

      // Create a case group for each alertCreatedFor configuration
      for (const ruleInstancesForGroup of ruleGroupsByAlertCreatedFor.values()) {
        const bestSubject = this.selectBestSubjectForRuleGroup(
          subjects,
          ruleInstancesForGroup
        )

        if (bestSubject) {
          caseGroups.push({
            subject: bestSubject,
            direction,
            ruleInstancesForGroup,
          })
        }
      }
    }

    return caseGroups.reduce((acc, curr) => {
      const existingGroup = acc.find(
        (group) =>
          group.subject.type === curr.subject.type &&
          group.direction === curr.direction
      )
      if (existingGroup) {
        existingGroup.ruleInstancesForGroup = [
          ...existingGroup.ruleInstancesForGroup,
          ...curr.ruleInstancesForGroup,
        ]
        return acc
      }
      return [...acc, curr]
    }, [] as CaseGroup[])
  }

  /**
   * Gets all rule instances that are relevant for a specific direction.
   */
  private getRuleInstancesForDirection(
    ruleInstances: ReadonlyArray<RuleInstance>,
    flattenedHitRules: ExtendedHitRulesDetails[],
    direction: RuleHitDirection
  ): ReadonlyArray<RuleInstance> {
    const relevantRuleInstanceIds = new Set<string>()

    // Find all rule instances that hit this direction
    for (const hitRule of flattenedHitRules) {
      if (
        hitRule.ruleHitMeta?.hitDirections?.some(
          (hitDirection) => hitDirection === direction
        )
      ) {
        relevantRuleInstanceIds.add(hitRule.ruleInstanceId)
      }
    }

    return ruleInstances.filter(
      (ri) => ri.id && relevantRuleInstanceIds.has(ri.id)
    )
  }

  /**
   * Groups rule instances by their alertCreatedFor configuration.
   */
  private groupRuleInstancesByAlertCreatedFor(
    ruleInstances: ReadonlyArray<RuleInstance>
  ): Map<string, RuleInstance[]> {
    const ruleGroupsByAlertCreatedFor = new Map<string, RuleInstance[]>()

    for (const ruleInstance of ruleInstances) {
      let { alertCreatedFor } = ruleInstance.alertConfig ?? {}
      alertCreatedFor =
        !alertCreatedFor || alertCreatedFor.length === 0
          ? ['USER']
          : alertCreatedFor

      // Create a key for this alertCreatedFor configuration
      const alertCreatedForKey = alertCreatedFor.sort().join(',')

      if (!ruleGroupsByAlertCreatedFor.has(alertCreatedForKey)) {
        ruleGroupsByAlertCreatedFor.set(alertCreatedForKey, [])
      }
      ruleGroupsByAlertCreatedFor.get(alertCreatedForKey)?.push(ruleInstance)
    }

    return ruleGroupsByAlertCreatedFor
  }

  /**
   * Selects the best subject for a group of rule instances with the same alertCreatedFor configuration.
   * Priority order: USER > PAYMENT > NAME > EMAIL > ADDRESS
   */
  private selectBestSubjectForRuleGroup(
    subjects: CaseSubject[],
    ruleInstancesForGroup: ReadonlyArray<RuleInstance>
  ): CaseSubject | null {
    if (ruleInstancesForGroup.length === 0) {
      return null
    }

    // Get the alertCreatedFor configuration (all rule instances in group should have the same)
    const firstRule = ruleInstancesForGroup[0]
    let { alertCreatedFor } = firstRule.alertConfig ?? {}
    alertCreatedFor =
      !alertCreatedFor || alertCreatedFor.length === 0
        ? ['USER']
        : alertCreatedFor

    // Filter subjects that match the alertCreatedFor configuration
    const matchingSubjects = subjects.filter((subject) => {
      switch (subject.type) {
        case 'PAYMENT':
          return alertCreatedFor?.includes('PAYMENT_DETAILS')
        case 'USER':
          return alertCreatedFor?.includes('USER')
        case 'ADDRESS':
          return alertCreatedFor?.includes('ADDRESS')
        case 'EMAIL':
          return alertCreatedFor?.includes('EMAIL')
        case 'NAME':
          return alertCreatedFor?.includes('NAME')
        default:
          return false
      }
    })

    if (matchingSubjects.length === 0) {
      return null
    }

    // Select the highest priority subject
    return matchingSubjects.reduce((best, current) => {
      return CASE_CREATION_PRIORITY[current.type] <
        CASE_CREATION_PRIORITY[best.type]
        ? current
        : best
    })
  }

  /**
   * Processes case creation/updates for a specific direction.
   * Handles filtering hit rules, managing delays, and creating/updating cases.
   */
  private async processCasesForDirection(
    subject: CaseSubject,
    direction: RuleHitDirection,
    directionRuleInstances: ReadonlyArray<RuleInstance>,
    flattenedHitRules: ExtendedHitRulesDetails[],
    params: {
      createdTimestamp: number
      latestTransactionArrivalTimestamp?: number
      priority: Priority
      transaction?: InternalTransaction
      hitRules: HitRulesDetails[]
      checkListTemplates?: ChecklistTemplate[]
    }
  ): Promise<Case[]> {
    // Filter hit rules for this direction
    let filteredHitRules = this.sanitizeHitRules(
      flattenedHitRules,
      direction
    ).filter((hitRule) => {
      if (
        !hitRule.ruleHitMeta?.hitDirections?.some(
          (hitDirection) => hitDirection === direction
        )
      ) {
        return false
      }
      return directionRuleInstances.some(
        (ri) => ri.id && ri.id === hitRule.ruleInstanceId
      )
    })

    if (filteredHitRules.length === 0) {
      return []
    }

    // Create filtered transaction with hit rules
    const filteredTransaction = params.transaction
      ? {
          ...params.transaction,
          hitRules: filteredHitRules,
        }
      : undefined

    // Remove hit rules that already have cases for the same transaction
    if (filteredTransaction) {
      // TODO: Check if this works if new transaction event comes in with the same hit rules but new search terms
      filteredHitRules = await this.filterDuplicateHitRules(
        subject,
        filteredTransaction,
        filteredHitRules
      )

      if (filteredHitRules.length === 0) {
        return []
      }
    }

    // Group hit rules by their delay timestamps
    const delayTimestampsGroups = await this.groupHitRulesByDelay(
      filteredHitRules,
      directionRuleInstances
    )

    // Get existing cases for this subject
    const casesParams: SubjectCasesQueryParams = {
      filterOutCaseStatus: 'CLOSED',
      filterMaxTransactions: MAX_TRANSACTION_IN_A_CASE,
      filterAvailableAfterTimestamp: delayTimestampsGroups.map(
        ({ availableAfterTimestamp }) => availableAfterTimestamp
      ),
      filterCaseType: 'SYSTEM',
    }
    const existingCases = await this.getCasesBySubject(subject, casesParams)

    const result: Case[] = []

    // Process each delay group
    for (const group of delayTimestampsGroups) {
      const { availableAfterTimestamp, hitRules, ruleInstances } = group
      const casesForTimestamp = existingCases
        .filter(
          (x) =>
            x.availableAfterTimestamp === availableAfterTimestamp ||
            (x.availableAfterTimestamp == null &&
              availableAfterTimestamp == null)
        )
        .sort((a, b) => (b.createdTimestamp ?? 0) - (a.createdTimestamp ?? 0))

      if (casesForTimestamp?.length) {
        // Update existing case
        const updatedCase = await this.updateExistingCase(
          casesForTimestamp[0],
          hitRules,
          ruleInstances,
          params,
          filteredTransaction
        )

        if (
          updatedCase.alerts &&
          updatedCase.alerts.length > MAX_ALERTS_IN_A_CASE
        ) {
          const { originalCase, newCase } =
            await this.splitCaseWithTooManyAlerts(
              updatedCase,
              subject,
              direction,
              availableAfterTimestamp
            )

          result.push(originalCase)
          result.push(newCase)
        } else {
          result.push(updatedCase)
        }
      } else {
        // Create new case
        const newCase = await this.createNewCase(
          subject,
          direction,
          hitRules,
          ruleInstances,
          params,
          filteredTransaction,
          availableAfterTimestamp
        )

        // Check if the new case has more than 1000 alerts and split if necessary
        if (newCase.alerts && newCase.alerts.length > 1000) {
          const { originalCase, newCase: splitNewCase } =
            await this.splitCaseWithTooManyAlerts(
              newCase,
              subject,
              direction,
              availableAfterTimestamp
            )
          result.push(originalCase)
          result.push(splitNewCase)
        } else {
          result.push(newCase)
        }
      }
    }

    return result
  }

  /**
   * Filters out hit rules that already have cases for the same transaction.
   */
  private async filterDuplicateHitRules(
    subject: CaseSubject,
    filteredTransaction: InternalTransaction,
    filteredHitRules: ExtendedHitRulesDetails[]
  ): Promise<ExtendedHitRulesDetails[]> {
    const casesHavingSameTransaction = await this.getCasesBySubject(subject, {
      filterTransactionId: filteredTransaction.transactionId,
      filterCaseType: 'SYSTEM',
    })

    return filteredHitRules.filter((hitRule) => {
      // Skip rules with per search alert (or per counterparty alert)
      if (
        hitRule.compositeRuleInstanceId ||
        hitRule.originPaymentMethodId ||
        hitRule.destinationPaymentMethodId
      ) {
        return true
      }

      return casesHavingSameTransaction.every((c) =>
        c.alerts?.every(
          (alert) => alert.ruleInstanceId !== hitRule.ruleInstanceId
        )
      )
    })
  }

  /**
   * Groups hit rules by their delay timestamps based on alert creation intervals.
   */
  private async groupHitRulesByDelay(
    filteredHitRules: ExtendedHitRulesDetails[],
    directionRuleInstances: ReadonlyArray<RuleInstance>
  ): Promise<
    Array<{
      availableAfterTimestamp: number | undefined
      hitRules: ExtendedHitRulesDetails[]
      ruleInstances: RuleInstance[]
    }>
  > {
    const now = Date.now()
    const timezone = await tenantTimezone(this.tenantId)

    const delayTimestamps = filteredHitRules.map((hitRule) => {
      const ruleInstanceMatch: RuleInstance | undefined =
        directionRuleInstances.find((x) => hitRule.ruleInstanceId === x.id)
      const availableAfterTimestamp: number | undefined =
        ruleInstanceMatch?.alertConfig?.alertCreationInterval != null
          ? calculateCaseAvailableDate(
              now,
              ruleInstanceMatch?.alertConfig?.alertCreationInterval,
              timezone
            )
          : undefined

      return {
        hitRule,
        ruleInstance: ruleInstanceMatch,
        availableAfterTimestamp,
      }
    })

    return Object.entries(
      groupBy(delayTimestamps, (x) => x.availableAfterTimestamp)
    ).map(([key, values]) => ({
      availableAfterTimestamp: key === 'undefined' ? undefined : parseInt(key),
      hitRules: values.map((x) => x.hitRule).filter(notNullish),
      ruleInstances: values.map((x) => x.ruleInstance).filter(notNullish),
    }))
  }

  /**
   * Updates an existing case with new alerts and transaction information.
   */
  private async updateExistingCase(
    existedCase: Case,
    hitRules: ExtendedHitRulesDetails[],
    ruleInstances: RuleInstance[],
    params: {
      createdTimestamp: number
      latestTransactionArrivalTimestamp?: number
      priority: Priority
      transaction?: InternalTransaction
      hitRules: HitRulesDetails[]
      checkListTemplates?: ChecklistTemplate[]
    },
    filteredTransaction?: InternalTransaction
  ): Promise<Case> {
    logger.debug(`Updating existing case`, {
      caseId: existedCase.caseId,
      transactionId: filteredTransaction?.transactionId,
    })

    // Separate closed and unclosed alerts
    const unclosedAlerts = compact(
      existedCase.alerts?.filter((a) => a.alertStatus !== 'CLOSED') || []
    )
    const closedAlerts = compact(
      existedCase.alerts?.filter((a) => a.alertStatus === 'CLOSED') || []
    )

    // Get or create new alerts for the existing case
    const updatedAlerts = await this.getOrCreateAlertsForExistingCase(
      hitRules,
      unclosedAlerts,
      ruleInstances,
      params.createdTimestamp,
      filteredTransaction,
      params.latestTransactionArrivalTimestamp,
      params.checkListTemplates
    )

    const newAlerts = updatedAlerts.filter((a) => !a.caseId)
    const allAlerts = [...updatedAlerts, ...closedAlerts]
    const caseAlerts = [
      ...allAlerts.filter((a) => a.caseId === existedCase.caseId),
      ...newAlerts,
    ]

    // Update case aggregates and transaction tracking
    const caseTransactionsIds = uniq(
      compact(caseAlerts?.flatMap((a) => a.transactionIds))
    )

    const transactionArrivalTimestamps = compact(
      caseAlerts.map((a) => a.latestTransactionArrivalTimestamp)
    )

    const now = Date.now()

    return {
      ...existedCase,
      latestTransactionArrivalTimestamp:
        transactionArrivalTimestamps.length > 0
          ? Math.max(...transactionArrivalTimestamps)
          : 0,
      caseTransactionsIds,
      caseAggregates:
        filteredTransaction?.transactionId &&
        caseTransactionsIds.includes(filteredTransaction.transactionId)
          ? generateCaseAggreates(
              [filteredTransaction as InternalTransaction],
              existedCase.caseAggregates,
              existedCase.caseUsers
            )
          : existedCase.caseAggregates,
      caseTransactionsCount: caseTransactionsIds.length,
      priority: minBy(caseAlerts, 'priority')?.priority ?? last(PRIORITYS),
      alerts: caseAlerts,
      updatedAt: now,
    }
  }

  /**
   * Splits a case that has more than 1000 alerts into two cases.
   * The original case keeps the first 1000 alerts, and a new case is created with the remaining alerts.
   */
  private async splitCaseWithTooManyAlerts(
    caseWithTooManyAlerts: Case,
    subject: CaseSubject,
    direction: RuleHitDirection,
    availableAfterTimestamp?: number
  ): Promise<{ originalCase: Case; newCase: Case }> {
    logger.debug(`Splitting case with too many alerts`, {
      caseId: caseWithTooManyAlerts.caseId,
      alertCount: caseWithTooManyAlerts.alerts?.length,
    })

    if (
      !caseWithTooManyAlerts.alerts ||
      caseWithTooManyAlerts.alerts.length <= MAX_ALERTS_IN_A_CASE
    ) {
      throw new Error('Case does not have more than 1000 alerts to split')
    }

    // Split alerts: first 1000 for original case, rest for new case
    const originalAlerts = caseWithTooManyAlerts.alerts.slice(
      0,
      MAX_ALERTS_IN_A_CASE
    )
    const excessAlerts =
      caseWithTooManyAlerts.alerts.slice(MAX_ALERTS_IN_A_CASE)

    // Update the original case with only the first 1000 alerts
    const originalCase: Case = {
      ...caseWithTooManyAlerts,
      alerts: originalAlerts,
      caseTransactionsIds: uniq(
        compact(originalAlerts?.flatMap((a) => a.transactionIds))
      ),
      caseTransactionsCount: uniq(
        compact(originalAlerts?.flatMap((a) => a.transactionIds))
      ).length,
      priority: minBy(originalAlerts, 'priority')?.priority ?? last(PRIORITYS),
      updatedAt: Date.now(),
    }

    // Create a new case with the excess alerts
    const newCase: Case = {
      ...this.getPartialCase(subject, direction, 'OPEN'),
      caseId: undefined, // Will be generated by the repository
      createdTimestamp: caseWithTooManyAlerts.createdTimestamp,
      latestTransactionArrivalTimestamp:
        caseWithTooManyAlerts.latestTransactionArrivalTimestamp,
      caseAggregates: caseWithTooManyAlerts.caseAggregates,
      caseTransactionsIds: uniq(
        compact(excessAlerts?.flatMap((a) => a.transactionIds))
      ),
      caseTransactionsCount: uniq(
        compact(excessAlerts?.flatMap((a) => a.transactionIds))
      ).length,
      priority: minBy(excessAlerts, 'priority')?.priority ?? last(PRIORITYS),
      availableAfterTimestamp,
      alerts: excessAlerts,
      updatedAt: Date.now(),
      relatedCases: compact(
        originalCase.caseId
          ? (originalCase.relatedCases ?? []).concat(originalCase.caseId)
          : originalCase.relatedCases
      ),
    }

    logger.debug(`Case split completed`, {
      originalCaseId: originalCase.caseId,
      newCaseId: newCase.caseId,
      originalAlertCount: originalCase.alerts?.length,
      newCaseAlertCount: newCase.alerts?.length,
    })

    return { originalCase, newCase }
  }

  /**
   * Creates a new case with alerts and initial configuration.
   */
  private async createNewCase(
    subject: CaseSubject,
    direction: RuleHitDirection,
    hitRules: ExtendedHitRulesDetails[],
    ruleInstances: RuleInstance[],
    params: {
      createdTimestamp: number
      latestTransactionArrivalTimestamp?: number
      priority: Priority
      transaction?: InternalTransaction
      hitRules: HitRulesDetails[]
      checkListTemplates?: ChecklistTemplate[]
    },
    filteredTransaction?: InternalTransaction,
    availableAfterTimestamp?: number
  ): Promise<Case> {
    logger.debug('Creating new case for transaction', {
      subjectType: subject.type,
      direction,
      transactionId: filteredTransaction?.transactionId,
    })

    // Create alerts for the new case
    const newAlerts = await this.getAlertsForNewCase(
      hitRules,
      ruleInstances,
      params.createdTimestamp,
      params.latestTransactionArrivalTimestamp,
      params.transaction,
      params.checkListTemplates
    )

    // Determine initial case status based on alert statuses
    const allAlertsClosed = newAlerts.every(
      (alert) => alert.alertStatus === 'CLOSED'
    )
    const initialStatus: CaseStatus = allAlertsClosed ? 'CLOSED' : 'OPEN'

    const now = Date.now()

    return {
      ...this.getPartialCase(subject, direction, initialStatus),
      createdTimestamp: availableAfterTimestamp ?? params.createdTimestamp,
      latestTransactionArrivalTimestamp:
        params.latestTransactionArrivalTimestamp,
      caseAggregates: this.createInitialCaseAggregates(
        filteredTransaction,
        subject
      ),
      caseTransactionsIds: filteredTransaction
        ? [filteredTransaction.transactionId as string]
        : [],
      caseTransactionsCount: filteredTransaction ? 1 : 0,
      priority: params.priority,
      availableAfterTimestamp,
      alerts: newAlerts,
      updatedAt: now,
    }
  }

  /**
   * Creates initial case aggregates from transaction and subject data.
   */
  private createInitialCaseAggregates(
    filteredTransaction?: InternalTransaction,
    subject?: CaseSubject
  ): CaseAggregates {
    return {
      originPaymentMethods: filteredTransaction?.originPaymentDetails?.method
        ? [filteredTransaction?.originPaymentDetails?.method]
        : [],
      destinationPaymentMethods: filteredTransaction?.destinationPaymentDetails
        ?.method
        ? [filteredTransaction?.destinationPaymentDetails?.method]
        : [],
      tags: uniqObjects(
        compact(filteredTransaction?.tags ?? []).concat(
          subject?.type === 'USER' && subject.user.tags ? subject.user.tags : []
        )
      ),
    }
  }

  private getPartialCase(
    subject: CaseSubject,
    direction: RuleHitDirection,
    status: CaseStatus = 'OPEN'
  ): Case {
    switch (subject.type) {
      case 'USER':
        return this.getNewUserCase(direction, subject.user, status)
      case 'PAYMENT':
        return this.getNewPaymentCase(direction, subject.paymentDetails, status)
      case 'ADDRESS':
        return this.getNewAddressCase(direction, subject.address, status)
      case 'EMAIL':
        return this.getNewEmailCase(direction, subject.email, status)
      case 'NAME':
        return this.getNewNameCase(direction, subject.name, status)
      default:
        throw new Error(`Invalid subject type`)
    }
  }

  private async sendAlertOpenedWebhook(alerts: Alert[], cases: Case[]) {
    const alertsRepository = new AlertsRepository(this.tenantId, {
      mongoDb: this.mongoDb,
      dynamoDb: this.dynamoDb,
    })
    const s3 = getS3Client()
    const { DOCUMENT_BUCKET, TMP_BUCKET } = process.env as CaseConfig
    const alertsService = new AlertsService(alertsRepository, s3, {
      tmpBucketName: TMP_BUCKET,
      documentBucketName: DOCUMENT_BUCKET,
    })
    await alertsService.sendAlertOpenedWebhook(alerts, cases)
  }

  async handleTransaction(
    transaction: InternalTransaction,
    ruleInstances: RuleInstance[],
    transactionSubjects: Record<RuleHitDirection, CaseSubject[] | undefined>
  ): Promise<Case[]> {
    logger.debug(`Handling transaction for case creation`, {
      transactionId: transaction.transactionId,
    })
    const result: Case[] = []

    const casePriority = CaseRepository.getPriority(
      ruleInstances.map((ruleInstance) => ruleInstance.casePriority)
    )

    const now = Date.now()

    logger.debug(`Updating cases`, {
      transactionId: transaction.transactionId,
    })
    const hitSubjects: Array<{
      subject: CaseSubject
      direction: RuleHitDirection
    }> = []

    // Collect all hit directions from rule hits
    const hitDirections: Set<RuleHitDirection> = new Set()
    for (const hitRule of transaction?.hitRules ?? []) {
      const ruleInstance = ruleInstances.find(
        (x) => x.id === hitRule.ruleInstanceId
      )
      if (ruleInstance && hitRule.ruleHitMeta?.hitDirections != null) {
        for (const ruleHitDirection of hitRule.ruleHitMeta.hitDirections) {
          hitDirections.add(ruleHitDirection)
        }
      }
    }

    // Create a hit user for every hit direction
    for (const ruleHitDirection of hitDirections) {
      const hitDirectionSubject = transactionSubjects[ruleHitDirection]
      if (hitDirectionSubject) {
        hitSubjects.push(
          ...hitDirectionSubject.map((subject) => ({
            subject,
            direction: ruleHitDirection,
          }))
        )
      }
    }

    const checkListTemplates = await this.getCheckListTemplates(
      ruleInstances,
      transaction?.hitRules ?? []
    )

    const cases = await this.getOrCreateCases(
      hitSubjects,
      {
        createdTimestamp: now,
        latestTransactionArrivalTimestamp: now,
        priority: casePriority,
        transaction,
        hitRules: transaction?.hitRules ?? [],
        checkListTemplates,
      },
      ruleInstances
    )
    result.push(...cases)

    const savedCases: Case[] = []
    for (const caseItem of cases) {
      savedCases.push(await this.addOrUpdateCase(caseItem))
    }

    const txAlerts = savedCases
      .flatMap((c) => c.alerts ?? [])
      .filter((alert) =>
        alert.transactionIds?.includes(transaction.transactionId)
      )
    if (txAlerts.length) {
      await this.transactionRepository.updateTransactionAlertIds(
        [transaction.transactionId],
        txAlerts.map((alert) => alert.alertId).filter(Boolean) as string[]
      )
    }

    logger.debug(`Updated/created cases count`, {
      count: savedCases.length,
    })

    return this.updateRelatedCases(savedCases)
  }

  @auditLog('CASE', 'CREATION', 'CREATE')
  async handleNewCases(
    tenantId: string,
    timestampBeforeCasesCreation: number,
    cases: Case[]
  ): Promise<NewCaseAuditLogReturnData> {
    if (isDemoTenant(tenantId)) {
      return {
        result: undefined,
        entities: [],
      }
    }
    const newAlerts = flatten(cases.map((c) => c.alerts)).filter(
      (alert) =>
        alert &&
        alert.createdTimestamp &&
        alert.createdTimestamp >= timestampBeforeCasesCreation
    )
    const newCases = cases.filter(
      (c) =>
        c.createdTimestamp && c.createdTimestamp >= timestampBeforeCasesCreation
    )

    await this.sendAlertOpenedWebhook((newAlerts ?? []) as Alert[], cases)

    if (await this.tenantRepository.getTenantMetadata('SLACK_WEBHOOK')) {
      for (const caseItem of newCases) {
        if (caseItem.availableAfterTimestamp) {
          continue
        }
        logger.debug(
          `Sending slack alert SQS message for case ${caseItem.caseId}`
        )
        const payload: NewCaseAlertPayload = {
          kind: 'NEW_CASE',
          tenantId,
          caseId: caseItem.caseId as string,
        }
        const sqs = getSQSClient()
        const sqsSendMessageCommand = new SendMessageCommand({
          MessageBody: JSON.stringify(payload),
          QueueUrl: getSQSQueueUrl(process.env.SLACK_ALERT_QUEUE_URL as string),
        })

        await sqs.send(sqsSendMessageCommand)
      }
    }

    const propertiesToPickForCase = [
      'caseId',
      'caseType',
      'createdBy',
      'createdTimestamp',
      'availableAfterTimestamp',
    ]

    const propertiesToPickForAlert = [
      'alertId',
      'parentAlertId',
      'createdTimestamp',
      'availableAfterTimestamp',
      'latestTransactionArrivalTimestamp',
      'caseId',
      'alertStatus',
      'ruleInstanceId',
      'ruleName',
      'ruleDescription',
      'ruleId',
      'ruleAction',
      'ruleNature',
      'numberOfTransactionsHit',
      'priority',
      'statusChanges',
      'lastStatusChange',
      'updatedAt',
    ]

    const auditLogEntities: AuditLogEntity<
      object,
      Alert | Partial<Alert> | Case | Partial<Case>
    >[] = []
    newCases.forEach((caseItem) => {
      auditLogEntities.push({
        entityId: caseItem?.caseId ?? '-',
        newImage: pick(caseItem, propertiesToPickForCase),
      })
    })

    newAlerts.forEach((alert) => {
      auditLogEntities.push({
        entityId: alert?.alertId ?? '-',
        newImage: pick(alert, propertiesToPickForAlert),
      })
    })

    return {
      result: undefined,
      entities: auditLogEntities,
    }
  }

  async handleUser(user: InternalUser): Promise<Case[]> {
    logger.debug(`Handling user for case creation`, {
      userId: user.userId,
    })
    const hitRules = user.hitRules ?? []
    if (hitRules.length === 0) {
      return []
    }

    const ruleInstances =
      await this.ruleInstanceRepository.getRuleInstancesByIds(
        filterLiveRules({ hitRules }).hitRules.map(
          (hitRule) => hitRule.ruleInstanceId
        )
      )

    const casePriority = CaseRepository.getPriority(
      ruleInstances.map((ruleInstance) => ruleInstance.casePriority)
    )
    const now = Date.now()
    const checkListTemplates = await this.getCheckListTemplates(
      ruleInstances,
      hitRules
    )
    logger.debug(`Updating cases`, {
      userId: user.userId,
    })

    const result = await this.getOrCreateCases(
      [{ subject: { type: 'USER', user }, direction: 'ORIGIN' }],
      {
        createdTimestamp: now,
        priority: casePriority,
        hitRules,
        checkListTemplates,
      },
      ruleInstances
    )

    const savedCases: Case[] = []
    for (const caseItem of result) {
      const alerts = this.filterOurEmptySanctionHits(caseItem.alerts ?? [])
      if (alerts.length) {
        savedCases.push(
          await this.addOrUpdateCase({
            ...caseItem,
            alerts,
          })
        )
      }
    }

    logger.debug(`Updated/created cases count`, {
      count: savedCases.length,
    })

    return this.updateRelatedCases(savedCases)
  }

  private async updateRelatedCases(savedCases: Case[]): Promise<Case[]> {
    if (savedCases.length <= 1) {
      return savedCases
    }
    const result: Case[] = []
    for (const savedCase of savedCases) {
      const relatedCases = [
        ...(savedCase.relatedCases ?? []),
        ...savedCases.map(({ caseId }) => caseId),
      ].filter((caseId) => caseId && caseId !== savedCase.caseId) as string[]
      result.push(
        await this.addOrUpdateCase({
          ...savedCase,
          relatedCases: uniq(relatedCases),
        })
      )
    }
    return result
  }

  public getUsersByRole = memoize(async (assignedRole: string) => {
    const rolesService = RoleService.getInstance(this.caseRepository.dynamoDb)
    const accountsService = AccountsService.getInstance(
      this.caseRepository.dynamoDb,
      true
    )
    const tenant = await accountsService.getTenantById(this.tenantId)
    if (!tenant) {
      return []
    }
    const data = await rolesService.getUsersByRole(assignedRole, tenant)
    return data.map((user) => user.id)
  })

  private shouldNotCreateNewAlert(
    alert: Alert,
    hitRule: ExtendedHitRulesDetails,
    ruleInstances: readonly RuleInstance[]
  ): boolean {
    return (
      this.getFrozenStatusFilter(alert, hitRule, ruleInstances) &&
      this.counterPartyAlertAlreadyExists(alert, hitRule, ruleInstances)
    )
  }

  private getFrozenStatusFilter(
    alert: Alert,
    rule: HitRulesDetails,
    ruleInstances?: readonly RuleInstance[]
  ): boolean {
    if (alert.ruleInstanceId === rule.ruleInstanceId) {
      const ruleInstance = ruleInstances?.find(
        (ruleInstance) => ruleInstance.id === alert.ruleInstanceId
      )
      return !ruleInstance?.alertConfig?.frozenStatuses?.some(
        (status) => status === getDerivedStatus(alert.alertStatus)
      )
    }
    return false
  }

  private counterPartyAlertAlreadyExists(
    alert: Alert,
    hitRule: ExtendedHitRulesDetails,
    ruleInstances: readonly RuleInstance[]
  ): boolean {
    const ruleInstance = ruleInstances.find(
      (x) => x.id === hitRule.ruleInstanceId
    )

    if (
      ruleInstance?.screeningAlertCreationLogic === 'PER_SEARCH_ALERT' ||
      ruleInstance?.alertCreationLogic === 'PER_COUNTERPARTY_ALERT'
    ) {
      if (alert.ruleHitMeta?.sanctionsDetails) {
        const isCounterpartyAlert = alert.ruleHitMeta?.sanctionsDetails?.find(
          (x) =>
            this.generateCompositeRuleInstanceId(
              alert.ruleInstanceId,
              x.hitContext?.searchTerm ?? ''
            ) === hitRule.compositeRuleInstanceId
        )

        return isCounterpartyAlert != null
      } else if (hitRule.destinationPaymentMethodId) {
        return (
          alert.alertMeta?.destinationPaymentMethodId ===
          hitRule.destinationPaymentMethodId
        )
      } else if (hitRule.originPaymentMethodId) {
        return (
          alert.alertMeta?.originPaymentMethodId ===
          hitRule.originPaymentMethodId
        )
      }
    }

    return true
  }

  async getRuleAlertAssignee(assignees?: string[], assignedRole?: string) {
    let assigneeId: string | undefined
    if ((assignees?.length ?? 0) >= 1) {
      assigneeId = sample(assignees)
    } else if (assignedRole) {
      const roleUsers = await this.getUsersByRole(assignedRole)
      assigneeId = sample(roleUsers)
    }
    return assigneeId
      ? ({
          assigneeUserId: assigneeId,
          assignedByUserId: FLAGRIGHT_SYSTEM_USER,
          timestamp: Date.now(),
        } as Assignment)
      : null
  }

  // NOTE: sanctionHitIds could be empty if all the corresponding hit entities are white-listed
  private filterOurEmptySanctionHits(alerts: Alert[]): Alert[] {
    return compact(
      alerts.map((alert) => {
        if (!alert.ruleHitMeta?.sanctionsDetails) {
          return alert
        }
        const filteredSanctionsDetails =
          alert.ruleHitMeta.sanctionsDetails.filter(
            (v) => !isEmpty(v.sanctionHitIds)
          )
        if (filteredSanctionsDetails.length === 0) {
          return null
        }
        return {
          ...alert,
          ruleHitMeta: {
            ...alert.ruleHitMeta,
            sanctionsDetails: filteredSanctionsDetails,
          },
        }
      })
    )
  }
}
