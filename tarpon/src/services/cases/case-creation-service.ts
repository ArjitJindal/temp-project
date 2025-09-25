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
import { SendMessageCommand, SQS } from '@aws-sdk/client-sqs'
import {
  APIGatewayEventLambdaAuthorizerContext,
  APIGatewayProxyWithLambdaAuthorizerEvent,
  Credentials as LambdaCredentials,
} from 'aws-lambda'
import { Credentials } from '@aws-sdk/client-sts'
import { S3 } from '@aws-sdk/client-s3'
import { COUNTERPARTY_RULES } from '@flagright/lib/constants'
import { backOff } from 'exponential-backoff'
import { filterLiveRules } from '../rules-engine/utils'
import { CounterRepository } from '../counter/repository'
import { AlertsService } from '../alerts'
import { S3Config } from '../aws/s3-service'
import { SLAPolicyService } from '../tenants/sla-policy-service'
import { SLAService } from '../sla/sla-service'
import { AccountsService } from '../accounts'
import { DynamoCaseRepository } from './dynamo-repository'
import { CaseService } from '.'
import {
  CaseRepository,
  MAX_TRANSACTION_IN_A_CASE,
  SubjectCasesQueryParams,
} from '@/services/cases/repository'
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
import { DEFAULT_CASE_AGGREGATES, generateCaseAggreates } from '@/utils/case'
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
import { CaseConfig } from '@/lambdas/console-api-case/app'
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
import { CaseSubject } from '@/services/case-alerts-common/utils'
import { isDemoTenant } from '@/utils/tenant-id'
import { CaseStatus } from '@/@types/openapi-internal/CaseStatus'
import { isConsoleMigrationEnabled } from '@/utils/clickhouse/utils'

import { SanctionsSearchHistory } from '@/@types/openapi-internal/SanctionsSearchHistory'
import { envIs } from '@/utils/env'

const RULEINSTANCE_SEPARATOR = '~$~'

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
  ): Promise<Record<RuleHitDirection, CaseSubject | undefined>> {
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

    let origin: CaseSubject | undefined = undefined
    if (isAnyRuleHasOriginHit) {
      if (originUserId) {
        const user = await this.getUser(originUserId)
        if (user != null) {
          origin = {
            type: 'USER',
            user: user,
          }
        }
      } else {
        if (originPaymentDetails != null) {
          origin = {
            type: 'PAYMENT',
            paymentDetails: originPaymentDetails,
          }
        }
      }
    }
    let destination: CaseSubject | undefined
    {
      if (destinationUserId) {
        if (!(isAnyRuleHasOriginHit && originUserId === destinationUserId)) {
          const user = await this.getUser(destinationUserId)
          if (user != null) {
            destination = {
              type: 'USER',
              user: user,
            }
          }
        }
      } else {
        if (
          !(
            isAnyRuleHasOriginHit &&
            isEqual(destinationPaymentDetails, originPaymentDetails)
          )
        ) {
          if (destinationPaymentDetails != null) {
            destination = {
              type: 'PAYMENT',
              paymentDetails: destinationPaymentDetails,
            }
          }
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
  ) {
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
    hitRules: HitRulesDetails[],
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
      hitRules.map(async (hitRule: HitRulesDetails): Promise<Alert | null> => {
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
                (await this.tenantSettings())?.defaultValues?.tenantTimezone ??
                  getDefaultTimezone()
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
      })
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
          const rawHits = searchResult?.response?.data ?? []
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

  private getNewUserCase(
    direction: RuleHitDirection,
    user: InternalConsumerUser | InternalBusinessUser,
    status: CaseStatus = 'OPEN'
  ): Case {
    const caseEntity: Case = {
      caseStatus: status,
      caseType: 'SYSTEM',
      subjectType: 'USER',
      caseUsers: {
        origin: direction === 'ORIGIN' ? user : undefined,
        destination: direction === 'DESTINATION' ? user : undefined,
      },
      caseAggregates: DEFAULT_CASE_AGGREGATES,
    }
    return caseEntity
  }

  private getNewPaymentCase(
    direction: RuleHitDirection,
    paymentDetails: PaymentDetails,
    status: CaseStatus = 'OPEN'
  ): Case {
    const caseEntity: Case = {
      caseStatus: status,
      caseType: 'SYSTEM',
      subjectType: 'PAYMENT',
      paymentDetails: {
        origin: direction === 'ORIGIN' ? paymentDetails : undefined,
        destination: direction === 'DESTINATION' ? paymentDetails : undefined,
      },
      caseAggregates: DEFAULT_CASE_AGGREGATES,
    }
    return caseEntity
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

  private async getCasesBySubject(
    subject: CaseSubject,
    params: SubjectCasesQueryParams
  ) {
    if (isConsoleMigrationEnabled()) {
      return this.dynamoCaseRepository.getCasesBySubject(subject, params)
    }
    return subject.type === 'USER'
      ? await this.caseRepository.getCasesByUserId(subject.user.userId, params)
      : await this.caseRepository.getCasesByPaymentDetails(
          subject.paymentDetails,
          params
        )
  }

  private flattenHitRules(
    hitRules: HitRulesDetails[],
    ruleInstances: readonly RuleInstance[]
  ): ExtendedHitRulesDetails[] {
    return hitRules.flatMap((hitRule) => {
      const ruleInstance = ruleInstances.find(
        (ruleInstance) => ruleInstance.id === hitRule.ruleInstanceId
      )

      if (ruleInstance?.screeningAlertCreationLogic === 'PER_SEARCH_ALERT') {
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
    const ruleInstances = hitRuleInstances.filter(
      (r) => r.alertCreationOnHit !== false
    )
    /**
     * The logic to handle the R-169 and R-170 for counterparties
     * - If they have PER_SEARCH_ALERT, we will create a composite ruleInstanceId which is combination of ruleInstanceId + search term
     */
    const flattenedHitRules: ExtendedHitRulesDetails[] = this.flattenHitRules(
      params.hitRules,
      ruleInstances
    )

    const result: Case[] = []
    for (const { subject, direction } of hitSubjects) {
      await acquireLock(this.dynamoDb, generateChecksum(subject), {
        startingDelay: 100,
        maxDelay: 5000,
      })

      try {
        // keep only user related hits
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
          const ruleInstance = ruleInstances.find(
            (x) => x.id === hitRule.ruleInstanceId
          )
          if (ruleInstance == null) {
            return false
          }
          // Create AlertFor Logic
          let { alertCreatedFor } = ruleInstance.alertConfig ?? {}
          alertCreatedFor =
            !alertCreatedFor || alertCreatedFor.length === 0
              ? ['USER']
              : alertCreatedFor

          if (
            !alertCreatedFor.includes('PAYMENT_DETAILS') &&
            subject.type === 'PAYMENT'
          ) {
            return false
          }

          if (!alertCreatedFor.includes('USER') && subject.type === 'USER') {
            return false
          }

          return true
        })
        if (filteredHitRules.length === 0) {
          continue
        }

        const filteredTransaction = params.transaction
          ? {
              ...params.transaction,
              hitRules: filteredHitRules,
            }
          : undefined

        if (filteredTransaction) {
          const casesHavingSameTransaction = await this.getCasesBySubject(
            subject,
            {
              filterTransactionId: filteredTransaction.transactionId,
              filterCaseType: 'SYSTEM',
            }
          )
          filteredHitRules = filteredHitRules.filter((hitRule) => {
            return casesHavingSameTransaction.every((c) =>
              c.alerts?.every(
                (alert) => alert.ruleInstanceId !== hitRule.ruleInstanceId
              )
            )
          })
          if (filteredHitRules.length === 0) {
            continue
          }
        }
        const now = Date.now()
        const timezone = await tenantTimezone(this.tenantId)
        const delayTimestamps = filteredHitRules.map((hitRule) => {
          const ruleInstanceMatch: RuleInstance | undefined =
            ruleInstances.find((x) => hitRule.ruleInstanceId === x.id)
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
        const delayTimestampsGroups = Object.entries(
          groupBy(delayTimestamps, (x) => x.availableAfterTimestamp)
        ).map(([key, values]) => ({
          availableAfterTimestamp:
            key === 'undefined' ? undefined : parseInt(key),
          hitRules: values.map((x) => x.hitRule).filter(notNullish),
          ruleInstances: values.map((x) => x.ruleInstance).filter(notNullish),
        }))

        const casesParams: SubjectCasesQueryParams = {
          filterOutCaseStatus: 'CLOSED',
          filterMaxTransactions: MAX_TRANSACTION_IN_A_CASE,
          filterAvailableAfterTimestamp: delayTimestampsGroups.map(
            ({ availableAfterTimestamp }) => availableAfterTimestamp
          ),
          filterCaseType: 'SYSTEM',
        }
        const cases = await this.getCasesBySubject(subject, casesParams)

        for (const group of delayTimestampsGroups) {
          const { availableAfterTimestamp, hitRules, ruleInstances } = group
          const existedCases = cases.filter(
            (x) =>
              x.availableAfterTimestamp === availableAfterTimestamp ||
              (x.availableAfterTimestamp == null &&
                availableAfterTimestamp == null)
          )

          if (existedCases?.length) {
            logger.debug(`Existed cases for user`, {
              existedCaseIds: existedCases.map((c) => c.caseId) ?? null,
              existedCaseTransactionsIdsLength: (
                existedCases.flatMap((c) => c.caseTransactionsIds) || []
              ).length,
            })

            const unclosedAlerts =
              compact(
                existedCases.flatMap(({ alerts }) =>
                  alerts?.filter((a) => a.alertStatus !== 'CLOSED')
                )
              ) ?? []
            const closedAlerts =
              compact(
                existedCases.flatMap(({ alerts }) =>
                  alerts?.filter((a) => a.alertStatus === 'CLOSED')
                )
              ) ?? []
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
            const existedCase = existedCases[0]
            const alerts = [...updatedAlerts, ...closedAlerts]
            const caseAlerts = [
              ...alerts.filter((a) => a.caseId === existedCase.caseId),
              ...newAlerts,
            ]
            const caseTransactionsIds = uniq(
              compact(caseAlerts?.flatMap((a) => a.transactionIds))
            )
            logger.debug('Update existed case with transaction')
            const transactionArrivalTimestamps = compact(
              caseAlerts.map((a) => a.latestTransactionArrivalTimestamp)
            )
            result.push({
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
              priority:
                minBy(caseAlerts, 'priority')?.priority ?? last(PRIORITYS),
              alerts: caseAlerts,
              updatedAt: now,
            })
          } else {
            const newAlerts = await this.getAlertsForNewCase(
              hitRules,
              ruleInstances,
              params.createdTimestamp,
              params.latestTransactionArrivalTimestamp,
              params.transaction,
              params.checkListTemplates
            )
            logger.debug('Create a new case for a transaction')

            // Check if all alerts are closed
            const allAlertsClosed = newAlerts.every(
              (alert) => alert.alertStatus === 'CLOSED'
            )
            const initialStatus: CaseStatus = allAlertsClosed
              ? 'CLOSED'
              : 'OPEN'

            result.push({
              ...(subject.type === 'USER'
                ? this.getNewUserCase(direction, subject.user, initialStatus)
                : this.getNewPaymentCase(
                    direction,
                    subject.paymentDetails,
                    initialStatus
                  )),
              createdTimestamp:
                availableAfterTimestamp ?? params.createdTimestamp,
              latestTransactionArrivalTimestamp:
                params.latestTransactionArrivalTimestamp,
              caseAggregates: {
                originPaymentMethods: filteredTransaction?.originPaymentDetails
                  ?.method
                  ? [filteredTransaction?.originPaymentDetails?.method]
                  : [],
                destinationPaymentMethods: filteredTransaction
                  ?.destinationPaymentDetails?.method
                  ? [filteredTransaction?.destinationPaymentDetails?.method]
                  : [],
                tags: uniqObjects(
                  compact(filteredTransaction?.tags ?? []).concat(
                    subject.type === 'USER' && subject.user.tags
                      ? subject.user.tags
                      : []
                  )
                ),
              },
              caseTransactionsIds: filteredTransaction
                ? [filteredTransaction.transactionId as string]
                : [],
              caseTransactionsCount: filteredTransaction ? 1 : 0,
              priority: params.priority,
              availableAfterTimestamp,
              alerts: newAlerts,
              updatedAt: now,
            })
          }
        }
      } finally {
        await releaseLock(this.dynamoDb, generateChecksum(subject))
      }
    }
    return result
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
    transactionSubjects: Record<RuleHitDirection, CaseSubject | undefined>
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
        hitSubjects.push({
          subject: hitDirectionSubject,
          direction: ruleHitDirection,
        })
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
        const sqs = new SQS({
          region: process.env.AWS_REGION,
        })
        const sqsSendMessageCommand = new SendMessageCommand({
          MessageBody: JSON.stringify(payload),
          QueueUrl: process.env.SLACK_ALERT_QUEUE_URL as string,
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
      this.searchTermAlreadyExists(alert, hitRule, ruleInstances)
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

  private searchTermAlreadyExists(
    alert: Alert,
    hitRule: ExtendedHitRulesDetails,
    ruleInstances: readonly RuleInstance[]
  ): boolean {
    const ruleInstance = ruleInstances.find(
      (x) => x.id === hitRule.ruleInstanceId
    )

    if (
      COUNTERPARTY_RULES.includes(hitRule.ruleId ?? '') &&
      ruleInstance?.screeningAlertCreationLogic === 'PER_SEARCH_ALERT'
    ) {
      const isCounterpartyAlert = alert.ruleHitMeta?.sanctionsDetails?.find(
        (x) =>
          this.generateCompositeRuleInstanceId(
            alert.ruleInstanceId,
            x.hitContext?.searchTerm ?? ''
          ) === hitRule.compositeRuleInstanceId
      )

      return isCounterpartyAlert != null
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
