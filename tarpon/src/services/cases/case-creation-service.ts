import {
  compact,
  flatten,
  groupBy,
  isEmpty,
  isEqual,
  last,
  memoize,
  minBy,
  pick,
  sample,
  uniq,
  uniqBy,
} from 'lodash'
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
import { filterLiveRules } from '../rules-engine/utils'
import { CounterRepository } from '../counter/repository'
import { AlertsService } from '../alerts'
import { S3Config } from '../aws/s3-service'
import { SLAPolicyService } from '../tenants/sla-policy-service'
import { CasesAlertsAuditLogService } from './case-alerts-audit-log-service'
import { CaseService } from '.'
import {
  CaseRepository,
  MAX_TRANSACTION_IN_A_CASE,
  SubjectCasesQueryParams,
} from '@/services/cases/repository'
import { Case } from '@/@types/openapi-internal/Case'
import { Alert } from '@/@types/openapi-internal/Alert'
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
import {
  AlertsRepository,
  FLAGRIGHT_SYSTEM_USER,
} from '@/services/alerts/repository'
import { Assignment } from '@/@types/openapi-internal/Assignment'
import { CaseAggregates } from '@/@types/openapi-internal/CaseAggregates'
import { DEFAULT_CASE_AGGREGATES, generateCaseAggreates } from '@/utils/case'
import {
  getContext,
  hasFeature,
  tenantSettings,
  tenantTimezone,
} from '@/core/utils/context'
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
import { getDefaultProvider } from '@/services/sanctions/utils'
import { acquireLock, releaseLock } from '@/utils/lock'
import { getDynamoDbClientByEvent } from '@/utils/dynamodb'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import { getCredentialsFromEvent } from '@/utils/credentials'
import { SLAPolicy } from '@/@types/openapi-internal/SLAPolicy'

type CaseSubject =
  | {
      type: 'USER'
      user: InternalUser
    }
  | {
      type: 'PAYMENT'
      paymentDetails: PaymentDetails
    }

@traceable
export class CaseCreationService {
  caseRepository: CaseRepository
  userRepository: UserRepository
  ruleInstanceRepository: RuleInstanceRepository
  transactionRepository: MongoDbTransactionRepository
  auditLogService: CasesAlertsAuditLogService
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
    this.ruleInstanceRepository = new RuleInstanceRepository(
      tenantID,
      connections
    )
    this.transactionRepository = new MongoDbTransactionRepository(
      tenantID,
      connections.mongoDb
    )
    this.auditLogService = new CasesAlertsAuditLogService(tenantID, connections)
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
    this.sanctionsSearchRepository = new SanctionsSearchRepository(
      tenantID,
      connections.mongoDb
    )
    this.sanctionsHitsRepository = new SanctionsHitsRepository(
      tenantID,
      connections.mongoDb
    )
    this.slaPolicyService = new SLAPolicyService(tenantID, connections.mongoDb)
  }

  private tenantSettings = memoize(async () => {
    return await tenantSettings(this.tenantId)
  })

  private async sendCasesOpenedWebhook(cases: Case[]) {
    const webhookTasks: ThinWebhookDeliveryTask<CaseOpenedDetails>[] =
      cases.map((case_) => ({
        event: 'CASE_OPENED',
        triggeredBy: 'SYSTEM',
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

  public async createManualCaseFromUser(
    manualCaseData: CaseStatusChange,
    files: FileInfo[],
    transactionIds: string[],
    priority?: Priority
  ): Promise<Case> {
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

    const case_ = await this.addOrUpdateCase({
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
      updatedAt: Date.now(),
      createdTimestamp: Date.now(),
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
        tags: compact(uniqObjects(transactions.flatMap((t) => t.tags ?? []))),
      },
      slaPolicyDetails:
        slaPolicies.length > 0
          ? slaPolicies.map((slaPolicy) => ({
              slaPolicyId: slaPolicy.id,
            }))
          : undefined,
    })

    if (!case_.caseId) {
      throw Error('Cannot find CaseId')
    }
    const comment = this.getManualCaseComment(
      manualCaseData,
      case_.caseId,
      files,
      transactions.map((t) => t.transactionId)
    )

    await this.auditLogService.createAuditLog({
      caseId: case_?.caseId,
      logAction: 'CREATE',
      caseDetails: case_, // Removed case transactions to prevent sqs message size limit
      newImage: case_,
      oldImage: {},
      subtype: 'MANUAL_CASE_CREATION',
    })
    if (this.caseService) {
      await this.caseService.saveComment(case_.caseId, comment)
    } else {
      await this.caseRepository.saveComment(case_.caseId, comment)
    }

    return case_
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
    const isAnyRuleHasOriginHit = transaction.hitRules.some(
      (hitRule) =>
        hitRule.ruleHitMeta?.hitDirections?.includes('ORIGIN') ?? false
    )

    logger.info(`Fetching case users by ids`, {
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
    hitRules: HitRulesDetails[],
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
          this.getFrozenStatusFilter(alert, hitRule, ruleInstances)
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
          this.getFrozenStatusFilter(existingAlert, newRuleHits, ruleInstances)
        )
    )

    return {
      existingAlerts,
      newAlerts,
    }
  }

  private async getOrCreateAlertsForExistingCase(
    hitRules: HitRulesDetails[],
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
    const mongoDb = this.mongoDb
    const counterRepository = new CounterRepository(this.tenantId, mongoDb)
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
        return {
          _id: alertCount,
          alertId: `A-${alertCount}`,
          createdTimestamp: availableAfterTimestamp ?? createdTimestamp,
          latestTransactionArrivalTimestamp,
          updatedAt: now,
          alertStatus:
            ruleInstanceMatch?.alertConfig?.defaultAlertStatus ?? 'OPEN',
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
          originPaymentMethods: transaction?.originPaymentDetails?.method
            ? [transaction?.originPaymentDetails?.method]
            : [],
          destinationPaymentMethods: transaction?.destinationPaymentDetails
            ?.method
            ? [transaction?.destinationPaymentDetails?.method]
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
          slaPolicyDetails: ruleInstanceMatch?.alertConfig?.slaPolicies?.map(
            (id): SLAPolicyDetails => ({
              slaPolicyId: id,
            })
          ),
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
            this.getFrozenStatusFilter(alert, rule, ruleInstances)
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
                sanctionsDetails: uniqBy(
                  [
                    ...(alert?.ruleHitMeta?.sanctionsDetails ?? []),
                    ...(sanctionsDetails ?? []),
                  ],
                  'searchId'
                ),
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

    const updatedSanctionsDetailsList = await Promise.all(
      sanctionsDetailsList.map(
        async (sanctionsDetail): Promise<SanctionsDetails | undefined> => {
          const searchResult =
            await this.sanctionsSearchRepository.getSearchResult(
              sanctionsDetail.searchId
            )
          const rawHits = searchResult?.response?.data ?? []
          if (update) {
            const { updatedIds, newIds } =
              await this.sanctionsHitsRepository.mergeHits(
                searchResult?.provider || getDefaultProvider(),
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
              searchResult?.provider || getDefaultProvider(),
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
    user: InternalConsumerUser | InternalBusinessUser
  ): Case {
    const caseEntity: Case = {
      caseStatus: 'OPEN',
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
    paymentDetails: PaymentDetails
  ): Case {
    const caseEntity: Case = {
      caseStatus: 'OPEN',
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

  private getCaseAggregatesFromTransactions(
    transactions: InternalTransaction[]
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
    const tags = uniqObjects(
      compact(transactions.flatMap(({ tags }) => tags ?? []))
    ).sort()

    return {
      originPaymentMethods,
      destinationPaymentMethods,
      tags,
    }
  }

  public async createNewCaseFromAlerts(
    sourceCase: Case,
    alertIds: string[]
  ): Promise<Case> {
    // Extract all alerts transactions
    const sourceAlerts = sourceCase.alerts ?? []
    const allAlertsTransactionIds: string[] = sourceAlerts
      .flatMap(({ transactionIds }) => transactionIds)
      .filter((id: string | undefined): id is string => id != null)
    const { data: allAlertsTransactions } =
      await this.transactionRepository.getTransactions({
        filterIdList: allAlertsTransactionIds,
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
      caseAggregates: this.getCaseAggregatesFromTransactions(
        newCaseAlertsTransactions ?? []
      ),
    })

    const oldCaseTransactionsIds = uniq(
      oldCaseAlertsTransactions.map(({ transactionId }) => transactionId)
    )

    await Promise.all([
      this.addOrUpdateCase({
        ...sourceCase,
        alerts: oldCaseAlerts,
        caseTransactionsIds: oldCaseTransactionsIds,
        caseTransactionsCount: oldCaseTransactionsIds.length,
        priority: minBy(oldCaseAlerts, 'priority')?.priority ?? last(PRIORITYS),
        updatedAt: now,
        caseAggregates: this.getCaseAggregatesFromTransactions(
          oldCaseAlertsTransactions ?? []
        ),
      }),
      this.auditLogService.handleAuditLogForNewCase(newCase),
      this.auditLogService.handleAuditLogForAlerts(
        sourceCase.caseId as string,
        sourceCase.alerts,
        newCase.alerts
      ),
    ])

    return newCase
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

  private async getCasesBySubject(
    subject: CaseSubject,
    params: SubjectCasesQueryParams
  ) {
    return subject.type === 'USER'
      ? await this.caseRepository.getCasesByUserId(subject.user.userId, params)
      : await this.caseRepository.getCasesByPaymentDetails(
          subject.paymentDetails,
          params
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
    logger.info(`Hit directions to create or update cases`, {
      hitDirections: hitSubjects.map((hitUser) => hitUser.direction),
    })
    const ruleInstances = hitRuleInstances.filter(
      (r) => r.alertCreationOnHit !== false
    )
    const result: Case[] = []
    for (const { subject, direction } of hitSubjects) {
      if (hasFeature('CONCURRENT_DYNAMODB_CONSUMER')) {
        await acquireLock(this.dynamoDb, generateChecksum(subject))
      }

      try {
        // keep only user related hits
        let filteredHitRules = params.hitRules.filter((hitRule) => {
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

        for (const {
          availableAfterTimestamp,
          ruleInstances,
          hitRules,
        } of delayTimestampsGroups) {
          const existedCase = cases.find(
            (x) =>
              x.availableAfterTimestamp === availableAfterTimestamp ||
              (x.availableAfterTimestamp == null &&
                availableAfterTimestamp == null)
          )

          if (existedCase) {
            logger.info(`Existed case for user`, {
              existedCaseId: existedCase?.caseId ?? null,
              existedCaseTransactionsIdsLength: (
                existedCase?.caseTransactionsIds || []
              ).length,
            })

            const unclosedAlerts =
              existedCase.alerts?.filter((a) => a.alertStatus !== 'CLOSED') ??
              []
            const closedAlerts =
              existedCase.alerts?.filter((a) => a.alertStatus === 'CLOSED') ??
              []
            const updatedAlerts = await this.getOrCreateAlertsForExistingCase(
              hitRules,
              unclosedAlerts,
              ruleInstances,
              params.createdTimestamp,
              filteredTransaction,
              params.latestTransactionArrivalTimestamp,
              params.checkListTemplates
            )
            const alerts = [...updatedAlerts, ...closedAlerts]
            const caseTransactionsIds = uniq(
              [
                ...(existedCase.caseTransactionsIds ?? []),
                filteredTransaction?.transactionId as string,
              ].filter(Boolean)
            )

            logger.info('Update existed case with transaction')
            result.push({
              ...existedCase,
              latestTransactionArrivalTimestamp:
                params.latestTransactionArrivalTimestamp,
              caseTransactionsIds,
              caseAggregates: generateCaseAggreates(
                [filteredTransaction as InternalTransaction],
                existedCase.caseAggregates
              ),
              caseTransactionsCount: caseTransactionsIds.length,
              priority: minBy(alerts, 'priority')?.priority ?? last(PRIORITYS),
              alerts,
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
            logger.info('Create a new case for a transaction')
            result.push({
              ...(subject.type === 'USER'
                ? this.getNewUserCase(direction, subject.user)
                : this.getNewPaymentCase(direction, subject.paymentDetails)),
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
                tags: uniqObjects(compact(filteredTransaction?.tags ?? [])),
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
        if (hasFeature('CONCURRENT_DYNAMODB_CONSUMER')) {
          await releaseLock(this.dynamoDb, generateChecksum(subject))
        }
      }
    }
    return result
  }

  private async sendAlertOpenedWebhook(alerts: Alert[], cases: Case[]) {
    const alertsRepository = new AlertsRepository(this.tenantId, {
      mongoDb: this.mongoDb,
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
    logger.info(`Handling transaction for case creation`, {
      transactionId: transaction.transactionId,
    })
    const result: Case[] = []

    const casePriority = CaseRepository.getPriority(
      ruleInstances.map((ruleInstance) => ruleInstance.casePriority)
    )

    const now = Date.now()

    logger.info(`Updating cases`, {
      transactionId: transaction.transactionId,
    })
    const hitSubjects: Array<{
      subject: CaseSubject
      direction: RuleHitDirection
    }> = []

    // Collect all hit directions from rule hits
    const hitDirections: Set<RuleHitDirection> = new Set()
    for (const hitRule of transaction.hitRules) {
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
      transaction.hitRules
    )

    const cases = await this.getOrCreateCases(
      hitSubjects,
      {
        createdTimestamp: now,
        latestTransactionArrivalTimestamp: now,
        priority: casePriority,
        transaction,
        hitRules: transaction.hitRules,
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

    logger.info(`Updated/created cases count`, {
      count: savedCases.length,
    })

    return this.updateRelatedCases(savedCases)
  }

  async handleNewCases(
    tenantId: string,
    timestampBeforeCasesCreation: number,
    cases: Case[]
  ) {
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
        logger.info(
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

    await Promise.all([
      ...newCases.map(
        async (caseItem) =>
          await this.auditLogService.handleAuditLogForNewCase(
            pick(caseItem, propertiesToPickForCase)
          )
      ),
      ...newAlerts.map(
        async (alert) =>
          await this.auditLogService.handleAuditLogForNewAlert(
            pick(alert, propertiesToPickForAlert)
          )
      ),
    ])
  }

  async handleUser(user: InternalUser): Promise<Case[]> {
    logger.info(`Handling user for case creation`, {
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
    logger.info(`Updating cases`, {
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

    logger.info(`Updated/created cases count`, {
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

  getUsersByRole = memoize(async (assignedRole) =>
    (await RoleService.getInstance().getUsersByRole(assignedRole))
      .map((user) => user?.user_id)
      .filter((user) => user !== undefined && user !== '')
  )

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
