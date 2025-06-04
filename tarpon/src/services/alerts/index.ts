import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb'
import { S3 } from '@aws-sdk/client-s3'
import { MongoClient } from 'mongodb'
import { BadRequest, Forbidden, NotFound } from 'http-errors'
import {
  capitalize,
  isEmpty,
  omit,
  startCase,
  toLower,
  uniq,
  isEqual,
  cloneDeep,
  difference,
  uniqBy,
  compact,
} from 'lodash'
import {
  APIGatewayEventLambdaAuthorizerContext,
  APIGatewayProxyWithLambdaAuthorizerEvent,
  Credentials,
} from 'aws-lambda'
import { Credentials as StsCredentials } from '@aws-sdk/client-sts'
import { uuid4 } from '@sentry/utils'
import { CaseAlertsCommonService } from '../case-alerts-common'
import { CaseRepository } from '../cases/repository'
import { sendWebhookTasks, ThinWebhookDeliveryTask } from '../webhook/utils'
import { ChecklistTemplatesService } from '../tenants/checklist-template-service'
import { MongoDbTransactionRepository } from '../rules-engine/repositories/mongodb-transaction-repository'
import { DynamoDbTransactionRepository } from '../rules-engine/repositories/dynamodb-transaction-repository'
import { sendBatchJobCommand } from '../batch-jobs/batch-job'
import { SLAService } from '../sla/sla-service'
import { RuleInstanceRepository } from '../rules-engine/repositories/rule-instance-repository'
import { SLAPolicyService } from '../tenants/sla-policy-service'
import { ListService } from '../list'
import { UserService } from '../users'
import { AlertParams, AlertsRepository } from './repository'
import { API_USER, FLAGRIGHT_SYSTEM_USER } from '@/utils/user'
import { Alert } from '@/@types/openapi-internal/Alert'
import { AlertListResponse } from '@/@types/openapi-internal/AlertListResponse'
import {
  DefaultApiGetAlertListRequest,
  DefaultApiGetAlertsQaSamplingRequest,
} from '@/@types/openapi-internal/RequestParameters'
import { addNewSubsegment, traceable } from '@/core/xray'
import { CaseEscalationRequest } from '@/@types/openapi-internal/CaseEscalationRequest'
import { CaseService } from '@/services/cases'
import { hasFeature } from '@/core/utils/context'
import { getContext } from '@/core/utils/context-storage'
import { Case } from '@/@types/openapi-internal/Case'
import { Account } from '@/@types/openapi-internal/Account'
import { Comment } from '@/@types/openapi-internal/Comment'
import { CaseHierarchyDetails } from '@/@types/openapi-internal/CaseHierarchyDetails'
import { CaseStatusChange } from '@/@types/openapi-internal/CaseStatusChange'
import { AlertClosedDetails } from '@/@types/openapi-public/AlertClosedDetails'
import { AlertStatusUpdateRequest } from '@/@types/openapi-internal/AlertStatusUpdateRequest'
import { Assignment } from '@/@types/openapi-internal/Assignment'
import { AccountsService } from '@/services/accounts'
import {
  ActionProcessingRecord,
  isAlertAvailable,
  sendActionProcessionTasks,
} from '@/services/cases/utils'
import {
  getMongoDbClient,
  sendMessageToMongoUpdateConsumer,
  withTransaction,
} from '@/utils/mongodb-utils'
import { CaseStatusUpdate } from '@/@types/openapi-internal/CaseStatusUpdate'
import { CaseStatus } from '@/@types/openapi-internal/CaseStatus'
import { getDynamoDbClient, getDynamoDbClientByEvent } from '@/utils/dynamodb'
import { getS3ClientByEvent } from '@/utils/s3'
import { CaseConfig } from '@/lambdas/console-api-case/app'
import {
  getMentionsFromComments,
  getParsedCommentBody,
  isStatusInReview,
  statusEscalated,
  statusEscalatedL2,
} from '@/utils/helpers'
import { ChecklistStatus } from '@/@types/openapi-internal/ChecklistStatus'
import { AlertQaStatusUpdateRequest } from '@/@types/openapi-internal/AlertQaStatusUpdateRequest'
import { ChecklistDoneStatus } from '@/@types/openapi-internal/ChecklistDoneStatus'
import { AlertsQaSamplingRequest } from '@/@types/openapi-internal/AlertsQaSamplingRequest'
import { AlertsQaSampling } from '@/@types/openapi-internal/AlertsQaSampling'
import { AlertQASamplingListResponse } from '@/@types/openapi-internal/AlertQASamplingListResponse'
import { AlertsQaSamplingUpdateRequest } from '@/@types/openapi-internal/AlertsQaSamplingUpdateRequest'
import { AlertsQASampleIds } from '@/@types/openapi-internal/AlertsQASampleIds'
import { CommentRequest } from '@/@types/openapi-internal/CommentRequest'
import { AlertOpenedDetails } from '@/@types/openapi-public/AlertOpenedDetails'
import { getCredentialsFromEvent } from '@/utils/credentials'
import { S3Config } from '@/services/aws/s3-service'
import { SLAPolicyDetails } from '@/@types/openapi-internal/SLAPolicyDetails'
import { CASES_COLLECTION } from '@/utils/mongodb-definitions'
import {
  auditLog,
  AuditLogEntity,
  AuditLogReturnData,
  getAlertAuditLogMetadata,
  getCaseAuditLogMetadata,
} from '@/utils/audit-log'
import {
  AlertUpdateAuditLogImage,
  AuditLogAssignmentsImage,
  CaseUpdateAuditLogImage,
  CommentAuditLogImage,
} from '@/@types/audit-log'
import { ChecklistItemValue } from '@/@types/openapi-internal/ChecklistItemValue'
import { FileInfo } from '@/@types/openapi-internal/FileInfo'
import { User } from '@/@types/openapi-public/User'
import { Business } from '@/@types/openapi-public/Business'
import { UserUpdateRequest } from '@/@types/openapi-internal/UserUpdateRequest'
import { ListItem } from '@/@types/openapi-internal/ListItem'

type AlertViewAuditLogReturnData = AuditLogReturnData<Alert>

type AlertEscalationAuditLogReturnData = AuditLogReturnData<
  { childCaseId?: string; assigneeIds: string[] },
  AlertUpdateAuditLogImage,
  AlertUpdateAuditLogImage
>

type AlertUpdateAuditLogReturnData = AuditLogReturnData<
  void,
  AlertUpdateAuditLogImage,
  AlertUpdateAuditLogImage
>

type AlertChecklistUpdateAuditLogReturnData = AuditLogReturnData<
  void,
  { ruleChecklist: ChecklistItemValue[] | undefined },
  { ruleChecklist: ChecklistItemValue[] | undefined }
>

type AlertQaUpdateAuditLogReturnData = AuditLogReturnData<
  void,
  object,
  {
    qaStatus: ChecklistStatus
    qaInfo: {
      reason: string[]
      comment: string | undefined
      files: FileInfo[] | undefined
    }
  }
>

type AlertCommentDeleteAuditLogReturnData = AuditLogReturnData<void, Comment>

@traceable
export class AlertsService extends CaseAlertsCommonService {
  alertsRepository: AlertsRepository
  tenantId: string
  mongoDb: MongoClient
  dynamoDb: DynamoDBDocumentClient
  caseRepository: CaseRepository
  ruleInstanceRepository: RuleInstanceRepository
  hasFeatureSla: boolean
  auth0Domain: string
  slaPolicyService: SLAPolicyService

  public static async fromEvent(
    event: APIGatewayProxyWithLambdaAuthorizerEvent<
      APIGatewayEventLambdaAuthorizerContext<StsCredentials>
    >
  ): Promise<AlertsService> {
    const { principalId: tenantId } = event.requestContext.authorizer
    const mongoDb = await getMongoDbClient()
    const s3 = getS3ClientByEvent(event)
    const dynamoDb = getDynamoDbClientByEvent(event)
    const repo = new AlertsRepository(tenantId, { mongoDb, dynamoDb })
    const { DOCUMENT_BUCKET, TMP_BUCKET } = process.env as CaseConfig

    return new AlertsService(
      repo,
      s3,
      { documentBucketName: DOCUMENT_BUCKET, tmpBucketName: TMP_BUCKET },
      getCredentialsFromEvent(event)
    )
  }

  constructor(
    alertsRepository: AlertsRepository,
    s3: S3,
    s3Config: S3Config,
    awsCredentials?: Credentials
  ) {
    super(s3, s3Config, awsCredentials, alertsRepository)
    this.alertsRepository = alertsRepository
    this.tenantId = alertsRepository.tenantId
    this.mongoDb = alertsRepository.mongoDb
    this.dynamoDb = alertsRepository.dynamoDb

    this.caseRepository = new CaseRepository(this.tenantId, {
      mongoDb: this.mongoDb,
      dynamoDb: this.dynamoDb,
    })

    this.ruleInstanceRepository = new RuleInstanceRepository(this.tenantId, {
      dynamoDb: this.dynamoDb,
    })
    this.hasFeatureSla = hasFeature('ALERT_SLA')
    this.auth0Domain = getContext()?.auth0Domain ?? ''
    this.slaPolicyService = new SLAPolicyService(this.tenantId, this.mongoDb)
  }

  @auditLog('ALERT', 'ALERT_LIST', 'DOWNLOAD')
  public async getAlerts(
    params: DefaultApiGetAlertListRequest,
    options?: { hideTransactionIds?: boolean }
  ): Promise<AuditLogReturnData<AlertListResponse>> {
    const caseGetSegment = await addNewSubsegment(
      'Case Service',
      'Mongo Get Alerts Query'
    )
    if (params.view === 'DOWNLOAD') {
      options = { ...options, hideTransactionIds: false }
    }
    try {
      const alerts: AlertListResponse = await this.alertsRepository.getAlerts(
        params,
        options
      )
      const data: AlertListResponse = {
        ...alerts,
        data: alerts.data.map((alertResponse) => ({
          ...alertResponse,
          alert: {
            ...alertResponse.alert,
            slaPolicyDetails: alertResponse.alert.slaPolicyDetails?.sort(
              (a, b) => {
                return (a?.startedAt ?? 0) - (b?.startedAt ?? 0)
              }
            ),
          },
        })),
      }
      return {
        result: data,
        entities:
          params.view === 'DOWNLOAD'
            ? [{ entityId: 'ALERT_DOWNLOAD', entityAction: 'DOWNLOAD' }]
            : [],
        publishAuditLog: () => params.view === 'DOWNLOAD',
      }
    } finally {
      caseGetSegment?.close()
    }
  }

  @auditLog('ALERT', 'VIEW_ALERT', 'VIEW')
  public async getAlert(
    alertId: string,
    options?: { auditLog?: boolean }
  ): Promise<AlertViewAuditLogReturnData> {
    const caseGetSegment = await addNewSubsegment(
      'Case Service',
      'Mongo Get Alert Query'
    )

    try {
      const alert = await this.alertsRepository.getAlertById(alertId)
      if (!alert || !isAlertAvailable(alert)) {
        throw new NotFound(`No alert for ${alertId}`)
      }

      const comments = await Promise.all([
        ...(alert.comments ?? [])
          .filter((c) => c.deletedAt == null)
          .map(async (c) => {
            if (!c.files) {
              return c
            }
            const files = await Promise.all(
              (c.files ?? []).map(async (f) => {
                return {
                  ...f,
                  downloadLink: await this.getDownloadLink(f),
                }
              })
            )
            return { ...c, files }
          }),
      ])

      return {
        result: { ...alert, comments },
        publishAuditLog: () => options?.auditLog ?? false,
        entities: [
          {
            entityId: alertId,
            logMetadata: getAlertAuditLogMetadata(alert),
          },
        ],
      }
    } finally {
      caseGetSegment?.close()
    }
  }

  public async validateAlertsQAStatus(
    alertIds: string[]
  ): Promise<{ valid: boolean }> {
    const alerts = await this.alertsRepository.validateAlertsQAStatus(alertIds)
    const requiredAlerts = alerts.filter((alert) =>
      alertIds.includes(alert.alertId ?? '')
    )

    const valid = requiredAlerts.every(
      (alert) =>
        alert.ruleChecklist?.every((item) => item.status) ||
        !alert.ruleChecklist?.length
    )

    return { valid }
  }

  // TODO: FIX THIS
  @auditLog('ALERT', 'STATUS_CHANGE', 'ESCALATE')
  public async escalateAlerts(
    caseId: string,
    caseEscalationRequest: CaseEscalationRequest
  ): Promise<AlertEscalationAuditLogReturnData> {
    const transactionsRepo = new MongoDbTransactionRepository(
      this.tenantId,
      this.mongoDb,
      this.dynamoDb
    )
    const accountsService = AccountsService.getInstance(this.dynamoDb, true)
    const accounts = await accountsService.getAllActiveAccounts()
    const currentUserId = getContext()?.user?.id
    const currentUserAccount = accounts.find((a) => a.id === currentUserId)
    const isPNB = hasFeature('PNB')

    if (!currentUserAccount) {
      throw new Forbidden('User not found or deleted')
    }

    const isReviewRequired = !!currentUserAccount.reviewerId

    const caseService = new CaseService(
      this.caseRepository,
      this.s3,
      this.s3Config,
      this.awsCredentials
    )

    const c = (await caseService.getCase(caseId)).result

    if (!c) {
      throw new NotFound(`Cannot find case ${caseId}`)
    }
    if (
      c.caseHierarchyDetails?.parentCaseId &&
      !hasFeature('MULTI_LEVEL_ESCALATION') &&
      !statusEscalatedL2(c.caseStatus)
    ) {
      throw new BadRequest(
        `Cannot escalated an already escalated case. Parent case ${c.caseHierarchyDetails?.parentCaseId}`
      )
    }
    let { alertEscalations } = caseEscalationRequest
    const { caseUpdateRequest } = caseEscalationRequest

    const alertIds = alertEscalations?.map((alert) => alert.alertId) || []
    const isTransactionsEscalation = alertEscalations?.some(
      (ae) => ae.transactionIds?.length ?? 0 > 0
    )

    // Hydrate escalation requests with the txn IDS if none were specified
    alertEscalations = alertEscalations?.map((alert) => {
      if (isEmpty(alert.transactionIds)) {
        return alert
      }
      alert.transactionIds = alert.transactionIds?.filter(
        (t) => !c.caseHierarchyDetails?.childTransactionIds?.includes(t)
      )
      if (alert.transactionIds?.length === 0) {
        throw new BadRequest(
          `Cannot escalate ${alert.alertId} as all of its transactions have already been escalated.`
        )
      }
      return alert
    })

    const currentTimestamp = Date.now()

    const escalatedAlerts = c.alerts?.filter((alert) =>
      alertEscalations?.some(
        (alertEscalation) => alertEscalation.alertId === alert.alertId
      )
    )

    const remainingAlerts = c.alerts?.filter(
      (alert) =>
        !alertEscalations?.some(
          (alertEscalation) =>
            alertEscalation.alertId === alert.alertId &&
            // Keep the original alert if only some transactions were escalated
            (isEmpty(alertEscalation.transactionIds) ||
              alertEscalation.transactionIds?.length ===
                alert.transactionIds?.length)
        )
    )

    // if there are no remaining alerts, then we are escalating the entire case
    // except for PNB (quickfix for escalation bugs)
    if (!isPNB && !remainingAlerts?.length && caseUpdateRequest) {
      // TODO: issue is here, we are escalating the case but case is already escalated compared to the alert
      //       we only want to escalate the only alert inside the case. we have to handle this differently
      const response = await caseService.escalateCase(caseId, caseUpdateRequest)
      return {
        result: response.result,
        publishAuditLog: () => false,
        entities: [],
      }
    }

    // this is for PNB only, escalate the alert without escalating the case
    if (isPNB && !remainingAlerts?.length && caseUpdateRequest) {
      if (!escalatedAlerts?.length) {
        throw new BadRequest('No alerts found to escalate')
      }

      const firstAlert = escalatedAlerts?.[0]
      const isAlreadyEscalated =
        statusEscalated(firstAlert?.alertStatus) &&
        !isStatusInReview(firstAlert?.alertStatus)
      const alertStatus = isAlreadyEscalated
        ? 'ESCALATED_L2'
        : isReviewRequired
        ? 'IN_REVIEW_ESCALATED'
        : 'ESCALATED'
      await this.updateStatus(
        alertIds,
        {
          alertStatus: alertStatus,
          reason: caseUpdateRequest?.reason ?? [],
          comment: caseUpdateRequest?.comment ?? '',
          files: caseUpdateRequest?.files ?? [],
          otherReason: caseUpdateRequest?.otherReason ?? '',
          priority: caseUpdateRequest?.priority,
          closeSourceCase: caseEscalationRequest.closeSourceCase,
          tags: caseUpdateRequest?.tags,
          screeningDetails: caseUpdateRequest?.screeningDetails,
          listId: caseUpdateRequest?.listId,
        },
        { cascadeCaseUpdates: false }
      )

      let assignee

      // this step is only necessary when escalating to L1 or L2
      // if (!(alertStatus === 'IN_REVIEW_ESCALATED')) {
      // we need to update reviewAsssignment structure with L1 or L2 assignments when escalating
      const newReviewAssignments =
        alertStatus === 'IN_REVIEW_ESCALATED'
          ? ([
              {
                assignedByUserId: currentUserId ?? '',
                assigneeUserId: currentUserAccount.reviewerId,
                timestamp: currentTimestamp,
              },
            ] as Assignment[])
          : await this.getEscalationAssignments(
              firstAlert?.alertStatus as CaseStatus,
              firstAlert.reviewAssignments || [],
              accounts
            )

      const reviewAssignments = uniqBy(
        [...newReviewAssignments, ...(firstAlert.reviewAssignments ?? [])],
        'assigneeUserId'
      )

      await this.alertsRepository.updateReviewAssignments(
        escalatedAlerts.map((alert) => alert.alertId ?? ''), // alertId is always defined
        reviewAssignments
      )

      if (alertStatus.startsWith('IN_REVIEW_ESCALATED')) {
        assignee = reviewAssignments.filter((r) => !r.escalationLevel)[0]
          ?.assigneeUserId
      } else if (statusEscalatedL2(alertStatus)) {
        assignee = reviewAssignments.filter(
          (r) => r.escalationLevel === 'L2'
        )[0]?.assigneeUserId
      } else if (statusEscalated(alertStatus)) {
        assignee = reviewAssignments.filter(
          (r) => r.escalationLevel === 'L1'
        )[0]?.assigneeUserId
      }
      // }

      return {
        result: {
          assigneeIds: [assignee],
        },
        publishAuditLog: () => false,
        entities: [],
      }
    }

    if (
      isReviewRequired &&
      alertEscalations &&
      !isStatusInReview(remainingAlerts?.[0]?.alertStatus) &&
      !isTransactionsEscalation &&
      !isPNB
    ) {
      await this.updateStatus(
        alertIds,
        {
          // alertStatus: 'IN_REVIEW_ESCALATED',
          alertStatus: 'ESCALATED',
          reason: caseUpdateRequest?.reason ?? [],
          comment: caseUpdateRequest?.comment ?? '',
          files: caseUpdateRequest?.files ?? [],
          otherReason: caseUpdateRequest?.otherReason ?? '',
          priority: caseUpdateRequest?.priority,
          closeSourceCase: caseEscalationRequest.closeSourceCase,
          tags: caseUpdateRequest?.tags,
          screeningDetails: caseUpdateRequest?.screeningDetails,
          listId: caseUpdateRequest?.listId,
        },
        { cascadeCaseUpdates: false }
      )

      if (caseUpdateRequest?.caseStatus) {
        await caseService.updateStatus(
          [caseId],
          {
            reason: caseUpdateRequest?.reason ?? [],
            comment: caseUpdateRequest?.comment ?? '',
            files: caseUpdateRequest?.files ?? [],
            caseStatus: caseUpdateRequest?.caseStatus,
            otherReason: caseUpdateRequest?.otherReason ?? '',
            priority: caseUpdateRequest?.priority,
            tags: caseUpdateRequest?.tags,
            screeningDetails: caseUpdateRequest?.screeningDetails,
            listId: caseUpdateRequest?.listId,
          },
          { filterInReview: true }
        )
      }

      return {
        result: {
          assigneeIds: [currentUserAccount.reviewerId as string],
        },
        publishAuditLog: () => false,
        entities: [],
      }
    }

    // if the reuqest specifies the alerts to be escalated
    // then we need to pick the first of the selected alerts
    let firstAlert = c.alerts?.[0]
    if (alertEscalations?.length) {
      firstAlert = c.alerts?.filter((alert) =>
        alertEscalations?.some(
          (alertEscalation) => alertEscalation.alertId === alert.alertId
        )
      )?.[0]
    }
    const existingReviewAssignments =
      statusEscalated(c.caseStatus) && !isStatusInReview(c.caseStatus)
        ? firstAlert?.reviewAssignments ?? []
        : []

    const assignmentStatus = isPNB ? firstAlert?.alertStatus : c.caseStatus
    const reviewAssignments = await this.getEscalationAssignments(
      assignmentStatus as CaseStatus,
      existingReviewAssignments,
      accounts
    )

    const newAlertsTransactions: Array<{
      alertId: string
      transactionIds: string[]
    }> = []
    // get the alerts that are being escalated
    const escalatedAlertsDetails = escalatedAlerts?.map(
      (escalatedAlert: Alert): Alert => {
        const isAlreadyEscalated = statusEscalated(escalatedAlert.alertStatus)
        const isInReviewEscalatedL1 = isStatusInReview(
          escalatedAlert.alertStatus
        ) // as we don't have In review for escalated L2
        const lastStatusChange: CaseStatusChange = {
          userId: currentUserId ?? '',
          caseStatus:
            // overriding isTransactionsEscalation == true for PNB
            (isPNB || isTransactionsEscalation) &&
            isReviewRequired &&
            !isAlreadyEscalated
              ? 'IN_REVIEW_ESCALATED'
              : isAlreadyEscalated &&
                !isInReviewEscalatedL1 && // Added this as isAlreadyEscalated also returns true for status 'IN_REVIEW_ESCALATED'
                hasFeature('MULTI_LEVEL_ESCALATION')
              ? 'ESCALATED_L2'
              : 'ESCALATED',
          timestamp: currentTimestamp,
          meta: { closeSourceCase: caseEscalationRequest.closeSourceCase },
        }

        const escalationAlertReq = alertEscalations?.find(
          (alertEscalation) =>
            alertEscalation.alertId === escalatedAlert.alertId
        )

        let { transactionIds, alertId, parentAlertId } = escalatedAlert
        if (escalationAlertReq?.transactionIds?.length) {
          const childNumber = c.caseHierarchyDetails?.childCaseIds
            ? c.caseHierarchyDetails.childCaseIds.length + 1
            : 1

          // Create a new alert if some transactions were selected.
          transactionIds = escalationAlertReq.transactionIds
          alertId = `${escalatedAlert.alertId}.${childNumber}`
          parentAlertId = escalatedAlert.alertId
          newAlertsTransactions.push({ alertId, transactionIds })
        }

        return {
          ...escalatedAlert,
          alertId,
          parentAlertId,
          alertStatus: lastStatusChange.caseStatus,
          reviewAssignments:
            isReviewRequired && currentUserAccount.reviewerId
              ? [
                  {
                    assignedByUserId: currentUserId ?? '',
                    assigneeUserId: currentUserAccount.reviewerId,
                    timestamp: currentTimestamp,
                  },
                ]
              : !isStatusInReview(escalatedAlert.alertStatus)
              ? uniqBy(
                  [
                    ...reviewAssignments,
                    ...(escalatedAlert.reviewAssignments ?? []),
                  ],
                  'assigneeUserId'
                )
              : reviewAssignments,
          statusChanges: escalatedAlert.statusChanges
            ? [...escalatedAlert.statusChanges, lastStatusChange]
            : [lastStatusChange],
          lastStatusChange,
          transactionIds,
        }
      }
    )

    for (const value of newAlertsTransactions) {
      await transactionsRepo.updateTransactionAlertIds(value.transactionIds, [
        value.alertId,
      ])
    }
    // child case id is the parent case id + the number of child cases
    const childNumber = c.caseHierarchyDetails?.childCaseIds
      ? c.caseHierarchyDetails.childCaseIds.length + 1
      : 1

    const childCaseId = `${c.caseId}.${childNumber}`

    // filter out transactions that were escalated from the case
    const filteredTransactionsForNewCase = (
      await transactionsRepo.getTransactionsByIds(c.caseTransactionsIds || [])
    )?.filter((transaction) =>
      transaction.hitRules.some((ruleInstance) =>
        escalatedAlertsDetails
          ?.map((eA) => eA.ruleInstanceId)
          .includes(ruleInstance.ruleInstanceId)
      )
    )

    const filteredTransactionIdsForNewCase =
      filteredTransactionsForNewCase?.map(
        (transaction) => transaction.transactionId
      )

    // filter out transactions that will be in existing case
    const filteredTransactionsForExistingCase = (
      await transactionsRepo.getTransactionsByIds(c.caseTransactionsIds || [])
    ).filter((transaction) =>
      transaction.hitRules.some((ruleInstance) =>
        remainingAlerts
          ?.map((rA) => rA.ruleInstanceId)
          .includes(ruleInstance.ruleInstanceId)
      )
    )

    const filteredTransactionIdsForExistingCase =
      filteredTransactionsForExistingCase?.map(
        (transaction) => transaction.transactionId
      )

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { statusChanges, lastStatusChange, ...mainCaseAttributes } = c

    let childTransactionIds =
      alertEscalations?.flatMap((a) => a.transactionIds || []) || []

    if (c.caseHierarchyDetails?.childTransactionIds) {
      childTransactionIds = childTransactionIds.concat(
        c.caseHierarchyDetails?.childTransactionIds
      )
    }

    childTransactionIds = uniq(childTransactionIds)

    let caseHierarchyDetailsForOriginalCase: CaseHierarchyDetails = {
      childCaseIds: [childCaseId],
      childTransactionIds,
      parentCaseId: c.caseHierarchyDetails?.parentCaseId,
    }

    if (c.caseHierarchyDetails?.childCaseIds) {
      caseHierarchyDetailsForOriginalCase = {
        childCaseIds: [...c.caseHierarchyDetails.childCaseIds, childCaseId],
        childTransactionIds,
        parentCaseId: c.caseHierarchyDetails.parentCaseId,
      }
    }

    const closeSourceCase =
      !isTransactionsEscalation &&
      (caseEscalationRequest.closeSourceCase ||
        escalatedAlerts?.some(
          (alert) => alert.lastStatusChange?.meta?.closeSourceCase === true
        ) ||
        false)

    const isStatusEscalatedL2 = statusEscalatedL2(
      escalatedAlertsDetails?.[0]?.alertStatus
    )

    const newCase: Case = {
      ...mainCaseAttributes,
      caseId: childCaseId,
      alerts: escalatedAlertsDetails,
      createdTimestamp: currentTimestamp,
      caseStatus:
        isStatusEscalatedL2 && hasFeature('MULTI_LEVEL_ESCALATION')
          ? 'ESCALATED_L2'
          : 'ESCALATED',
      reviewAssignments: isStatusEscalatedL2
        ? uniqBy(
            [
              ...(mainCaseAttributes.reviewAssignments ?? []),
              ...reviewAssignments,
            ],
            'assigneeUserId'
          )
        : reviewAssignments,
      caseTransactionsIds: filteredTransactionIdsForNewCase,
      caseHierarchyDetails: { parentCaseId: caseId },
      lastStatusChange: undefined,
      statusChanges: [],
      comments: [],
    }

    if (isTransactionsEscalation && isReviewRequired && !isStatusEscalatedL2) {
      newCase.caseStatus = 'IN_REVIEW_ESCALATED'
    }

    const updatedExistingCase: Case = {
      ...c,
      alerts: remainingAlerts,
      caseTransactionsIds: filteredTransactionIdsForExistingCase,
      caseHierarchyDetails: caseHierarchyDetailsForOriginalCase,
    }

    if (closeSourceCase) {
      const lastStatusChange = {
        userId: currentUserId ?? '',
        timestamp: Date.now(),
        caseStatus: 'CLOSED' as const,
      }
      updatedExistingCase.lastStatusChange = lastStatusChange
      updatedExistingCase.statusChanges = [
        ...(updatedExistingCase.statusChanges ?? []),
        lastStatusChange,
      ]
      updatedExistingCase.caseStatus = 'CLOSED'
    }

    await this.caseRepository.addCaseMongo(omit(newCase, '_id'))
    await this.caseRepository.addCaseMongo(updatedExistingCase)

    await caseService.updateStatus([newCase.caseId ?? ''], {
      ...caseUpdateRequest,
      caseStatus: newCase.caseStatus,
    })

    const updatedTransactions =
      alertEscalations?.flatMap((item) => item.transactionIds ?? []) ?? []

    const auditLogEntities: AuditLogEntity<
      AlertUpdateAuditLogImage | CaseUpdateAuditLogImage,
      AlertUpdateAuditLogImage | CaseUpdateAuditLogImage
    >[] = []

    if (childCaseId) {
      auditLogEntities.push({
        entityId: caseId,
        oldImage: {
          caseStatus: c.caseStatus,
          reviewAssignments: c.reviewAssignments,
          assignments: c.assignments,
        },
        newImage: {
          ...caseUpdateRequest,
          reason: caseUpdateRequest?.reason ?? [],
          updatedTransactions,
          caseStatus: newCase.caseStatus,
          reviewAssignments: newCase.reviewAssignments,
          assignments: newCase.assignments,
        },
        logMetadata: getCaseAuditLogMetadata(newCase),
        entityType: 'CASE',
        entitySubtype: 'STATUS_CHANGE',
        entityAction: 'ESCALATE',
      })
    }

    const data = {
      ...caseUpdateRequest,
      alertCaseId: childCaseId,
      updatedTransactions,
      reason: caseUpdateRequest?.reason ?? [],
      reviewAssignments,
    }
    for (const alertId of alertIds) {
      const alertEntity = c.alerts?.find((alert) => alert.alertId === alertId)

      if (!alertEntity) {
        continue
      }

      const oldImage: AlertUpdateAuditLogImage = {
        alertStatus: alertEntity.alertStatus,
        reviewAssignments: alertEntity.reviewAssignments,
        assignments: alertEntity.assignments,
      }

      auditLogEntities.push({
        entityId: alertId,
        oldImage: oldImage,
        newImage: { ...data, alertStatus: 'ESCALATED' },
        logMetadata: getAlertAuditLogMetadata(alertEntity),
      })
    }

    const assigneeIds = reviewAssignments
      .map((v) => v.assigneeUserId)
      .filter(Boolean)
    return { result: { childCaseId, assigneeIds }, entities: auditLogEntities }
  }

  public static formatReasonsComment(params: {
    reasons?: (string | 'Other')[]
    otherReason?: string
  }): undefined | string {
    const { reasons, otherReason } = params
    const allReasons = [
      ...(reasons?.filter((x) => x !== 'Other') ?? []),
      ...(reasons?.includes('Other') && otherReason ? [otherReason] : []),
    ]
    return allReasons.join(', ')
  }

  public async getCommentsByAlertId(alertId: string): Promise<Comment[]> {
    const alert = await this.alertsRepository.getAlertById(alertId)

    if (alert == null) {
      throw new NotFound(`"${alertId}" alert not found`)
    }
    const comments = await Promise.all(
      (alert.comments ?? []).map(async (c) => {
        const files = await this.getUpdatedFiles(c.files)
        return {
          ...c,
          files,
        }
      })
    )
    return comments
  }

  public async getCommentByCommentId(
    alertId: string,
    commentId: string
  ): Promise<Comment> {
    const alert = await this.alertsRepository.getAlertById(alertId)
    if (alert == null) {
      throw new NotFound(`"${alertId}" alert not found`)
    }

    const comment = alert.comments?.find((c) => c.id === commentId)

    if (comment == null) {
      throw new NotFound(`"${commentId}" comment not found`)
    }
    const files = await this.getUpdatedFiles(comment.files)
    return {
      ...comment,
      files: files,
    }
  }

  @auditLog('ALERT', 'COMMENT', 'CREATE')
  public async saveComment(
    alertId: string,
    comment: CommentRequest,
    externalRequest?: boolean
  ): Promise<
    AuditLogReturnData<Comment, CommentAuditLogImage, CommentAuditLogImage>
  > {
    const alert = await this.alertsRepository.getAlertById(alertId)

    if (alert == null) {
      throw new NotFound(`"${alertId}" alert not found`)
    }

    const files = await this.s3Service.copyFilesToPermanentBucket(
      comment.files || []
    )

    const userId = externalRequest ? API_USER : getContext()?.user?.id

    const savedComment = await this.alertsRepository.saveComment(
      alert.caseId ?? '',
      alertId,
      { ...comment, files, userId }
    )
    const mentions = externalRequest
      ? undefined
      : getMentionsFromComments(comment.body)

    await Promise.all([
      ...(savedComment.id
        ? [this.sendFilesAiSummaryBatchJob([alertId], savedComment.id)]
        : []),
    ])

    return {
      result: {
        ...savedComment,
        files: await this.getUpdatedFiles(savedComment.files),
      },
      entities: [
        {
          entityId: alertId,
          newImage: {
            ...savedComment,
            body: getParsedCommentBody(savedComment.body),
            mentions,
          },
        },
      ],
    }
  }

  public async saveCommentReply(
    alertId: string,
    commentId: string,
    reply: Comment
  ): Promise<Comment> {
    const alert = await this.alertsRepository.getAlertById(alertId)

    if (alert == null) {
      throw new NotFound(`"${alertId}" alert not found`)
    }

    const comment = alert.comments?.find((c) => c.id === commentId)

    if (comment == null) {
      throw new NotFound(`"${commentId}" comment not found`)
    }

    const response = await this.saveComment(alertId, {
      ...reply,
      parentId: commentId,
    })
    return response.result
  }

  private async sendFilesAiSummaryBatchJob(
    alertIds: string[],
    commentId: string
  ) {
    if (!hasFeature('FILES_AI_SUMMARY')) {
      return
    }

    await Promise.all([
      alertIds.map(async (alertId) => {
        await sendBatchJobCommand({
          type: 'FILES_AI_SUMMARY',
          tenantId: this.tenantId,
          parameters: {
            commentId,
            type: 'ALERT',
            entityId: alertId,
          },
          awsCredentials: this.awsCredentials,
        })
      }),
    ])
  }

  private async saveComments(
    alertIds: string[],
    caseIds: string[],
    comment: Comment
  ): Promise<Comment> {
    const files = await this.s3Service.copyFilesToPermanentBucket(
      comment.files || []
    )

    const savedComment = await this.alertsRepository.saveAlertsComment(
      alertIds,
      caseIds,
      { ...comment, files }
    )

    if (savedComment.id) {
      await this.sendFilesAiSummaryBatchJob(alertIds, savedComment.id)
    }

    return {
      ...savedComment,
      files: await this.getUpdatedFiles(savedComment.files),
    }
  }

  // TODO: FIX THIS
  @auditLog('ALERT', 'ASSIGNMENT', 'UPDATE')
  public async updateAssignments(
    alertIds: string[],
    assignments: Assignment[]
  ): Promise<
    AuditLogReturnData<void, AuditLogAssignmentsImage, AuditLogAssignmentsImage>
  > {
    const timestamp = Date.now()
    const existingAlerts = await this.getAlertsByIds(alertIds)

    if (existingAlerts.length !== alertIds.length) {
      throw new NotFound(
        `Alerts not found: ${difference(
          alertIds,
          existingAlerts.map((a) => a.alertId)
        ).join(', ')}`
      )
    }

    assignments.forEach((a) => {
      a.timestamp = timestamp
    })
    const auditLogEntities: AuditLogEntity<
      AuditLogAssignmentsImage,
      AuditLogAssignmentsImage
    >[] = []
    await Promise.all([
      this.alertsRepository.updateAssignments(alertIds, assignments),
      ...alertIds.map(async (alertId) => {
        const oldAlert = existingAlerts.find((a) => a.alertId === alertId)
        auditLogEntities.push({
          entityId: alertId,
          oldImage: { assignments: oldAlert?.assignments },
          newImage: { assignments },
          logMetadata: getAlertAuditLogMetadata(oldAlert),
        })
      }),
      ...(this.hasFeatureSla
        ? existingAlerts.map((alert) => {
            return this.updateAlertWithSlaDetails(
              {
                ...alert,
                assignments: assignments,
                updatedAt: timestamp,
              },
              timestamp
            )
          })
        : []),
    ])
    return {
      result: undefined,
      entities: auditLogEntities,
    }
  }

  private async updateAlertWithSlaDetails(alert: Alert, timestamp: number) {
    const ruleInstance = await this.ruleInstanceRepository.getRuleInstanceById(
      alert.ruleInstanceId
    )
    const slaPolicyIds = ruleInstance?.alertConfig?.slaPolicies ?? []
    const slaService = new SLAService(this.tenantId, this.auth0Domain, {
      mongoDb: this.mongoDb,
      dynamoDb: this.alertsRepository.dynamoDb,
    })
    const slaPolicyDetails: SLAPolicyDetails[] = await Promise.all(
      slaPolicyIds.map(async (id) => {
        const slaDetail = await slaService.calculateSLAStatusForEntity<Alert>(
          alert,
          id,
          'alert'
        )
        return {
          ...(slaDetail?.elapsedTime
            ? {
                elapsedTime: slaDetail?.elapsedTime,
                policyStatus: slaDetail?.policyStatus,
                startedAt: slaDetail?.startedAt,
              }
            : {}),
          slaPolicyId: id,
          updatedAt: timestamp,
        }
      }) || []
    )
    await sendMessageToMongoUpdateConsumer({
      filter: {
        'alerts.alertId': alert.alertId,
      },
      operationType: 'updateOne',
      updateMessage: {
        $set: {
          'alerts.$[alert].slaPolicyDetails': slaPolicyDetails,
        },
      },
      sendToClickhouse: true,
      collectionName: CASES_COLLECTION(this.tenantId),
      arrayFilters: [{ 'alert.alertId': alert.alertId }],
    })
  }

  @auditLog('ALERT', 'REVIEW_ASSIGNMENT', 'UPDATE')
  public async updateReviewAssignments(
    alertIds: string[],
    reviewAssignments: Assignment[]
  ): Promise<
    AuditLogReturnData<void, AuditLogAssignmentsImage, AuditLogAssignmentsImage>
  > {
    const timestamp = Date.now()
    const existingAlerts = await this.getAlertsByIds(alertIds)

    reviewAssignments.forEach((a) => {
      a.timestamp = timestamp
    })
    const auditLogEntities: AuditLogEntity<
      AuditLogAssignmentsImage,
      AuditLogAssignmentsImage
    >[] = []
    await Promise.all([
      this.alertsRepository.updateReviewAssignments(
        alertIds,
        reviewAssignments
      ),
      ...alertIds.map(async (alertId) => {
        const oldAlert = existingAlerts.find((a) => a.alertId === alertId)
        auditLogEntities.push({
          entityId: alertId,
          oldImage: { reviewAssignments: oldAlert?.reviewAssignments },
          newImage: { reviewAssignments },
          logMetadata: getAlertAuditLogMetadata(oldAlert),
        })
      }),
      ...(this.hasFeatureSla
        ? existingAlerts.map((alert) => {
            return this.updateAlertWithSlaDetails(
              {
                ...alert,
                reviewAssignments: reviewAssignments,
                updatedAt: timestamp,
              },
              timestamp
            )
          })
        : []),
    ])

    return {
      result: undefined,
      entities: [],
    }
  }

  @auditLog('ALERT', 'COMMENT', 'DELETE')
  public async deleteComment(
    alertId: string,
    commentId: string
  ): Promise<AlertCommentDeleteAuditLogReturnData> {
    const alert = await this.alertsRepository.getAlertById(alertId)
    const comment = alert?.comments?.find(({ id }) => id === commentId) ?? null

    if (comment == null || alert == null) {
      throw new NotFound(`Alert comment not found`)
    }

    const caseId = alert.caseId

    if (caseId == null) {
      throw new Error(`Alert case id is null`)
    }

    await withTransaction(async () => {
      await Promise.all([
        this.alertsRepository.deleteComment(caseId, alertId, commentId),
      ])
    })
    return {
      result: undefined,
      entities: [
        {
          entityId: alertId,
          oldImage: comment,
        },
      ],
    }
  }

  private getAlertStatusChangeCommentBody(
    statusUpdateRequest: AlertStatusUpdateRequest,
    currentStatus?: CaseStatus
  ): string {
    const { alertStatus, reason, otherReason, comment } = statusUpdateRequest
    const currentIsReview = isStatusInReview(currentStatus)
    const isReview = isStatusInReview(alertStatus)
    let body = `Alert status changed to ${
      isReview ? 'In Review' : capitalize(alertStatus.toLowerCase())
    }${
      isReview
        ? ' and is requested to be ' +
          capitalize(alertStatus.replace('IN_REVIEW_', '').toLowerCase())
        : ''
    }`

    if (currentIsReview) {
      if (currentStatus?.replace('IN_REVIEW_', '') === alertStatus) {
        body = `Alert is Approved and its status is changed to ${capitalize(
          alertStatus.toLowerCase()
        )}`
      } else {
        body = `Alert is Declined and its status is changed to ${capitalize(
          alertStatus.toLowerCase()
        )}`
      }
    }

    const allReasons = [
      ...(reason?.filter((x) => x !== 'Other') ?? []),
      ...(otherReason ? [otherReason] : []), // Changed logic to display other reason even without other selected as enum from public management API
    ]

    if (allReasons.length > 0) {
      body += `. Reasons: ${allReasons.join(', ')}`
    }

    if (comment) {
      body += `\n${comment}`
    }

    return body
  }

  public async getAlertsByIds(alertIds: string[]): Promise<Alert[]> {
    return this.alertsRepository.getAlertsByIds(alertIds)
  }

  private async updateUserDetails(
    cases: Case[],
    updates: AlertStatusUpdateRequest
  ) {
    const usersData: { caseId: string; user: User | Business }[] = []
    const listId = updates.listId
    const tags = updates.tags
    const screeningDetails = updates.screeningDetails
    const eoddDate = updates.eoddDate
    cases.forEach((c) => {
      const user = c?.caseUsers?.origin ?? c?.caseUsers?.destination
      if (user && user.userId) {
        usersData.push({
          caseId: c.caseId ?? '',
          user: user as User | Business,
        })
      }
    })

    const userService = new UserService(this.tenantId, {
      mongoDb: this.mongoDb,
      dynamoDb: this.caseRepository.dynamoDb,
    })

    const listService = new ListService(this.tenantId, {
      mongoDb: this.mongoDb,
      dynamoDb: this.caseRepository.dynamoDb,
    })

    const updateObject: UserUpdateRequest = {
      ...(updates.kycStatusDetails?.status && {
        kycStatusDetails: {
          status: updates.kycStatusDetails.status,
          reason: updates.kycStatusDetails.reason,
          description: updates.kycStatusDetails.description,
        },
      }),
      ...(updates.userStateDetails?.state && {
        userStateDetails: {
          state: updates.userStateDetails.state,
          reason: updates.userStateDetails.reason,
          description: updates.userStateDetails.description,
        },
      }),
      ...(eoddDate && {
        eoddDate,
      }),
      ...(tags && {
        tags: tags,
      }),
      ...(screeningDetails?.pepStatus && {
        pepStatus: screeningDetails.pepStatus,
      }),
      ...(screeningDetails &&
        !!screeningDetails.sanctionsStatus ===
          screeningDetails.sanctionsStatus && {
          sanctionsStatus: screeningDetails.sanctionsStatus,
        }),
      ...(screeningDetails &&
        !!screeningDetails.adverseMediaStatus ===
          screeningDetails.adverseMediaStatus && {
          adverseMediaStatus: screeningDetails.adverseMediaStatus,
        }),
    }

    if (isEmpty(updateObject)) {
      return
    }

    if (!isEmpty(usersData)) {
      await Promise.all(
        usersData.map(({ user, caseId }) =>
          userService.updateUser(user, updateObject, {}, { caseId })
        )
      )

      if (listId) {
        await Promise.all(
          usersData.map(({ user }) => {
            let userFullName = ''
            if ('userDetails' in user && user.userDetails?.name) {
              const {
                firstName = '',
                middleName = '',
                lastName = '',
              } = user.userDetails.name
              userFullName =
                [lastName, firstName, middleName].filter(Boolean).join(' ') ||
                ''
            } else if (
              'legalEntity' in user &&
              Array.isArray(user.legalEntity)
            ) {
              userFullName =
                user.legalEntity?.companyGeneralDetails?.legalName || ''
            }

            const listItem: ListItem = {
              key: user.userId,
              metadata: {
                reason: '',
                userFullName,
              },
            }
            return listService.updateOrCreateListItem(listId, listItem)
          })
        )
      }
    }
  }

  // TODO: FIX THIS
  @auditLog('ALERT', 'STATUS_CHANGE', 'UPDATE')
  public async updateStatus(
    alertIds: string[],
    statusUpdateRequest: AlertStatusUpdateRequest,
    options?: {
      bySystem?: boolean
      cascadeCaseUpdates?: boolean
      skipReview?: boolean
      account?: Account
      updateChecklistStatus?: boolean
      externalRequest?: boolean
    }
  ): Promise<AlertUpdateAuditLogReturnData> {
    if (!alertIds.length) {
      return {
        result: undefined,
        publishAuditLog: () => false,
        entities: [],
      }
    }

    const {
      bySystem,
      // cascadeCaseUpdates = true,
      skipReview = false,
      account,
      updateChecklistStatus = true,
      externalRequest = false,
    } = options ?? {}

    // override the case updates as a quickfix for PNB bugs
    const isPNB = hasFeature('PNB')
    const isClosing = statusUpdateRequest.alertStatus === 'CLOSED'
    const cascadeCaseUpdates = isPNB && !isClosing ? false : true

    const userId = externalRequest ? API_USER : getContext()?.user?.id
    const statusChange: CaseStatusChange = {
      userId: bySystem
        ? FLAGRIGHT_SYSTEM_USER
        : userId ?? FLAGRIGHT_SYSTEM_USER,
      timestamp: Date.now(),
      reason: statusUpdateRequest.reason,
      caseStatus: statusUpdateRequest.alertStatus,
      otherReason: statusUpdateRequest.otherReason,
      meta: {
        closeSourceCase: statusUpdateRequest.closeSourceCase,
      },
    }

    const accountsService = await AccountsService.getInstance(this.dynamoDb)
    let userAccount: Account | undefined = undefined
    if (!externalRequest && userId) {
      userAccount =
        account ?? ((await accountsService.getAccount(userId)) || undefined)
      if (userAccount == null) {
        throw new Error(`User account not found`)
      }
    }
    let isReview = false

    const [alerts, cases] = await Promise.all([
      this.getAlertsByIds(alertIds),
      this.caseRepository.getCasesByAlertIds(alertIds),
    ])

    const alertsNotFound = alertIds.filter(
      (alertId) => !alerts.find((alert) => alert?.alertId === alertId)
    )

    if (alertsNotFound.length) {
      throw new NotFound(`Alerts not found: ${alertsNotFound.join(', ')}`)
    }

    const isInProgressOrOnHold =
      statusUpdateRequest.alertStatus.endsWith('ON_HOLD') ||
      statusUpdateRequest.alertStatus.endsWith('IN_PROGRESS')

    const isLastInReview = isStatusInReview(alerts[0]?.alertStatus)

    if (
      userAccount?.reviewerId &&
      !isInProgressOrOnHold &&
      !skipReview &&
      !isLastInReview &&
      hasFeature('ADVANCED_WORKFLOWS') &&
      !externalRequest
    ) {
      if (!userAccount.reviewerId) {
        throw new Error(`User account reviewerId is null`)
      }
      const caseStatusToChange = statusChange.caseStatus?.replace(
        'IN_REVIEW_',
        ''
      )

      statusChange.caseStatus = `IN_REVIEW_${caseStatusToChange}` as CaseStatus
      statusUpdateRequest.alertStatus =
        `IN_REVIEW_${caseStatusToChange}` as CaseStatus

      isReview = true
    }

    const caseIds = cases.map((c) => c.caseId ?? '')
    const commentBody = this.getAlertStatusChangeCommentBody(
      statusUpdateRequest,
      alerts[0]?.alertStatus
    )

    const caseService = new CaseService(
      this.caseRepository,
      this.s3,
      this.s3Config,
      this.awsCredentials
    )

    const alertsWithPreviousEscalations = alerts.filter((alert) =>
      statusEscalated(alert.alertStatus)
    )

    // get the first alert
    const firstAlert = alerts[0]
    // get all the users accounts
    const accounts = await accountsService.getAllActiveAccounts()

    await withTransaction(async () => {
      const [response] = await Promise.all([
        this.alertsRepository.updateStatus(
          alertIds,
          caseIds,
          statusChange,
          undefined
        ),
        this.saveComments(alertIds, caseIds, {
          userId: statusChange.userId,
          body: commentBody,
          files: statusUpdateRequest.files,
          type: 'STATUS_CHANGE',
        }),
        ...(isReview && userAccount?.reviewerId && !skipReview
          ? [
              this.alertsRepository.updateInReviewAssignments(
                alertIds,
                [
                  {
                    assigneeUserId: userId ?? '',
                    assignedByUserId: FLAGRIGHT_SYSTEM_USER,
                    timestamp: Date.now(),
                  },
                ],
                [
                  {
                    assigneeUserId: userAccount.reviewerId,
                    assignedByUserId: userId,
                    timestamp: Date.now(),
                  },
                ]
              ),
            ]
          : []),
        ...(isPNB && !isReview
          ? [
              await this.alertsRepository.updateReviewAssignments(
                alertIds,
                uniqBy(
                  [
                    ...(await this.getEscalationAssignments(
                      firstAlert?.alertStatus as CaseStatus,
                      firstAlert.reviewAssignments || [],
                      accounts
                    )),
                    ...(firstAlert.reviewAssignments ?? []),
                  ],
                  'assigneeUserId'
                )
              ),
            ]
          : []),
        ...(!externalRequest &&
        hasFeature('ADVANCED_WORKFLOWS') &&
        alertsWithPreviousEscalations.length &&
        statusUpdateRequest?.alertStatus === 'CLOSED'
          ? [
              this.alertsRepository.updateReviewAssignmentsToAssignments(
                alertsWithPreviousEscalations?.map(
                  (alert) => alert.alertId ?? ''
                )
              ),
            ]
          : []),
        ...(statusUpdateRequest?.alertStatus === 'CLOSED' &&
        updateChecklistStatus &&
        hasFeature('QA')
          ? [this.alertsRepository.markAllChecklistItemsAsDone(alertIds)]
          : []),
        ...(this.hasFeatureSla
          ? alerts.map((alert) => {
              return this.updateAlertWithSlaDetails(
                {
                  ...alert,
                  alertStatus: statusChange.caseStatus,
                  lastStatusChange: statusChange,
                  statusChanges: [...(alert.statusChanges ?? []), statusChange],
                  updatedAt: Date.now(),
                },
                Date.now()
              )
            })
          : []),
      ])
      await this.updateUserDetails(cases, statusUpdateRequest)
      const caseIdsWithAllAlertsSameStatus =
        response.caseIdsWithAllAlertsSameStatus // Only for escalated and closed alerts

      if (
        caseIdsWithAllAlertsSameStatus.length &&
        cascadeCaseUpdates &&
        response.caseStatusToChange &&
        !isInProgressOrOnHold
      ) {
        if (response.caseStatusToChange === 'CLOSED') {
          // Get all cases that need to be closed
          const casesToUpdate = caseIdsWithAllAlertsSameStatus
            .map((caseId) => cases.find((c) => c.caseId === caseId))
            .filter(Boolean)

          // Collect unique reasons from all alerts in these cases
          const allReasons = new Set<string>()
          let otherReason = ''

          // First check current alert's reason
          if (statusUpdateRequest.reason?.length) {
            statusUpdateRequest.reason.forEach((r) => allReasons.add(r))
            if (statusUpdateRequest.otherReason) {
              otherReason = statusUpdateRequest.otherReason
            }
          }

          // Then check all other closed alerts in these cases
          for (const c of casesToUpdate) {
            const closedAlerts =
              c?.alerts?.filter((a) => a.alertStatus === 'CLOSED') || []
            for (const alert of closedAlerts) {
              const lastChange = alert.statusChanges?.find(
                (sc) => sc.caseStatus === 'CLOSED'
              )
              if (lastChange?.reason) {
                lastChange.reason.forEach((r) => allReasons.add(r))
              }
              if (lastChange?.otherReason && !otherReason) {
                otherReason = lastChange.otherReason
              }
            }
          }

          // Generate consolidated update request
          const caseUpdateStatus: CaseStatusUpdate = {
            caseStatus: 'CLOSED',
            reason: allReasons.size
              ? (Array.from(allReasons) as (string | 'Other')[])
              : ['Other'],
            comment: statusUpdateRequest.comment,
            otherReason:
              otherReason ||
              (allReasons.size
                ? undefined
                : `All alerts of this case are closed`),
            files: statusUpdateRequest.files,
          }

          await caseService.updateStatus(
            caseIdsWithAllAlertsSameStatus,
            caseUpdateStatus,
            {
              bySystem: true,
              cascadeAlertsUpdate: false,
              account: userAccount,
              updateChecklistStatus: false,
              externalRequest: externalRequest,
            }
          )
        } else {
          // Original behavior for non-CLOSED statuses
          const otherReason = `All alerts of this case are ${startCase(
            toLower(response?.caseStatusToChange ?? '')
          )}`

          const caseUpdateStatus: CaseStatusUpdate = {
            caseStatus: response.caseStatusToChange,
            reason: ['Other'],
            comment: statusUpdateRequest.comment,
            otherReason,
            files: statusUpdateRequest.files,
          }

          await caseService.updateStatus(
            caseIdsWithAllAlertsSameStatus,
            caseUpdateStatus,
            {
              bySystem: true,
              cascadeAlertsUpdate: false,
              account: userAccount,
              updateChecklistStatus: false,
              externalRequest: externalRequest,
            }
          )
        }
      }

      if (
        statusUpdateRequest.alertStatus === 'CLOSED' &&
        hasFeature('SANCTIONS')
      ) {
        await Promise.all(
          alertIds.map(async (alertId) => {
            const alert = alerts.find((alert) => alert.alertId === alertId)
            const c = cases.find((c) => c.caseId === alert?.caseId)
            if (!c || !alert) {
              return
            }
          })
        )
      }
    })

    if (statusUpdateRequest.alertStatus === 'CLOSED' && !externalRequest) {
      await this.sendAlertClosedWebhook(alertIds, cases, statusUpdateRequest)
    }
    if (statusUpdateRequest.alertStatus === 'CLOSED') {
      await sendActionProcessionTasks(
        compact(
          alerts.map((val): ActionProcessingRecord | undefined => {
            if (!val.alertId) {
              return undefined
            }
            return {
              entityId: val.alertId,
              reason: {
                reasons: statusUpdateRequest.reason,
                comment: statusUpdateRequest.comment ?? '',
                timestamp: Date.now(),
              },
              action: 'CLOSED',
              tenantId: this.tenantId,
            }
          })
        )
      )
    }

    const auditLogEntities = await Promise.all(
      alerts.map(async (oldAlert) => {
        const alertId = oldAlert.alertId as string
        const alertEntity = await this.alertsRepository.getAlertById(alertId)

        const oldImage: AlertUpdateAuditLogImage = {
          alertStatus: oldAlert.alertStatus,
          reviewAssignments: oldAlert.reviewAssignments,
          assignments: oldAlert.assignments,
        }

        const newImage: AlertUpdateAuditLogImage = {
          ...statusUpdateRequest,
          alertStatus: statusUpdateRequest.alertStatus,
          reviewAssignments: alertEntity?.reviewAssignments,
          assignments: alertEntity?.assignments,
        }

        return {
          entityId: alertId,
          oldImage,
          newImage,
          logMetadata: {
            caseId: alertEntity?.caseId,
          },
        }
      })
    )

    return {
      result: undefined,
      entities: auditLogEntities,
    }
  }

  private async sendAlertClosedWebhook(
    alertIds: string[],
    cases: Case[],
    statusUpdateRequest: AlertStatusUpdateRequest
  ) {
    const { reason, otherReason } = statusUpdateRequest
    const commentBody =
      this.getAlertStatusChangeCommentBody(statusUpdateRequest)

    const webhookTasks: ThinWebhookDeliveryTask<AlertClosedDetails>[] = []

    for (const alertId of alertIds) {
      const case_ = cases.find((c) =>
        c.alerts?.some((a) => a.alertId === alertId)
      )

      const alert = case_?.alerts?.find((a) => a.alertId === alertId)

      if (alert) {
        webhookTasks.push({
          event: 'ALERT_CLOSED',
          triggeredBy: 'MANUAL',
          entityId: alertId,
          payload: {
            alertId,
            reasons: reason,
            reasonDescriptionForOther: otherReason,
            comment: commentBody,
            ruleId: alert.ruleId,
            ruleInstanceId: alert.ruleInstanceId,
            ruleName: alert.ruleName,
            ruleDescription: alert.ruleDescription,
            userId:
              case_?.caseUsers?.origin?.userId ??
              case_?.caseUsers?.destination?.userId,
            transactionIds: alert.transactionIds,
          },
        })
      }
    }

    await sendWebhookTasks<AlertClosedDetails>(this.tenantId, webhookTasks)
  }

  @auditLog('ALERT', 'CHECKLIST_ITEM_STATUS_CHANGE', 'UPDATE')
  async updateAlertChecklistStatus(
    alertId: string,
    checklistItemIds: string[],
    done: ChecklistDoneStatus,
    comment?: string
  ): Promise<AlertChecklistUpdateAuditLogReturnData> {
    const alert = await this.alertsRepository.getAlertById(alertId)
    if (!alert) {
      throw new NotFound('No alert')
    }

    if (!alert.ruleChecklistTemplateId) {
      throw new NotFound('Alert has no checklist')
    }
    const originalChecklist = cloneDeep(alert.ruleChecklist)
    const updatedChecklist = alert.ruleChecklist?.map((checkListItem) => {
      if (
        checkListItem.checklistItemId &&
        checklistItemIds.includes(checkListItem.checklistItemId)
      ) {
        checkListItem.done = done
        checkListItem.comment = comment
      }
      return checkListItem
    })
    if (isEqual(originalChecklist, updatedChecklist)) {
      return {
        result: undefined,
        entities: [],
      } // No changes made to the checklist
    }
    alert.ruleChecklist = updatedChecklist
    await this.alertsRepository.updateAlertChecklistStatus(
      alertId,
      updatedChecklist ?? []
    )
    return {
      result: undefined,
      entities: [
        {
          entityId: alertId,
          oldImage: { ruleChecklist: originalChecklist },
          newImage: { ruleChecklist: updatedChecklist },
        },
      ],
    }
  }

  @auditLog('ALERT', 'CHECKLIST_ITEM_STATUS_CHANGE', 'UPDATE')
  async updateAlertChecklistQaStatus(
    alertId: string,
    checklistItemIds: string[],
    status: ChecklistStatus
  ): Promise<AlertChecklistUpdateAuditLogReturnData> {
    const alert = await this.alertsRepository.getAlertById(alertId)
    if (!alert) {
      throw new NotFound('No alert')
    }
    if (!alert.ruleChecklistTemplateId) {
      throw new NotFound('Alert has no checklist')
    }
    const originalChecklist = cloneDeep(alert.ruleChecklist)
    const updatedChecklist = alert.ruleChecklist?.map((checkListItem) => {
      if (
        checkListItem.checklistItemId &&
        checklistItemIds.includes(checkListItem.checklistItemId)
      ) {
        checkListItem.status = status
      }
      return checkListItem
    })
    if (isEqual(originalChecklist, updatedChecklist)) {
      return {
        result: undefined,
        entities: [],
      } // No changes made to the checklist
    }

    alert.ruleChecklist = updatedChecklist

    await this.alertsRepository.updateAlertChecklistStatus(
      alertId,
      updatedChecklist ?? []
    )

    return {
      result: undefined,
      entities: [
        {
          entityId: alertId,
          oldImage: { ruleChecklist: originalChecklist },
          newImage: { ruleChecklist: updatedChecklist },
        },
      ],
    }
  }

  private async acceptanceCriteriaPassed(
    alert: Pick<Alert, 'ruleChecklistTemplateId' | 'ruleChecklist'>
  ): Promise<boolean> {
    const ruleChecklistTemplateId = alert.ruleChecklistTemplateId

    if (!ruleChecklistTemplateId) {
      return true
    }

    const checklistTemplate =
      await this.checklistTemplateService().getChecklistTemplate(
        ruleChecklistTemplateId
      )

    if (!checklistTemplate) {
      throw new NotFound('Checklist template not found')
    }

    const p1FailedAllowed =
      checklistTemplate.qaPassCriteria?.p1Errors ?? Number.MAX_SAFE_INTEGER
    const p2FailedAllowed =
      checklistTemplate.qaPassCriteria?.p2Errors ?? Number.MAX_SAFE_INTEGER
    let p1sFailed = 0
    let p2sFailed = 0
    checklistTemplate.categories.forEach((category) => {
      category.checklistItems.forEach((checklistItem) => {
        const alertChecklistItem = alert.ruleChecklist?.find(
          (rcli) => rcli.checklistItemId === checklistItem.id
        )
        if (!alertChecklistItem || alertChecklistItem.status === 'FAILED') {
          if (checklistItem.level === 'P1') {
            p1sFailed++
          }
          if (checklistItem.level === 'P2') {
            p2sFailed++
          }
        }
      })
    })

    return p1sFailed <= p1FailedAllowed && p2sFailed <= p2FailedAllowed
  }

  private checklistTemplateService(): ChecklistTemplatesService {
    return new ChecklistTemplatesService(this.tenantId, this.mongoDb)
  }

  @auditLog('ALERT', 'CHECKLIST_QA_STATUS_CHANGE', 'UPDATE')
  async updateAlertQaStatus(
    update: AlertQaStatusUpdateRequest
  ): Promise<AlertQaUpdateAuditLogReturnData> {
    const auditLogEntities: AuditLogEntity<
      object,
      {
        qaStatus: ChecklistStatus
        qaInfo: {
          reason: string[]
          comment: string | undefined
          files: FileInfo[] | undefined
        }
      }
    >[] = []
    const alerts = await this.getAlertsByIds(update.alertIds)
    const comment = `Alert QA status set to ${update.checklistStatus} with comment: ${update.comment}`

    const promises: Promise<void | AlertUpdateAuditLogReturnData>[] =
      alerts.map(async (alert) => {
        let updatedAssignments: Assignment[] = []

        if (update.checklistStatus === 'FAILED') {
          // Find who closed the alert and reassign them
          const originalAssignee = alert.statusChanges
            ?.slice()
            .reverse()
            .find((sc) => sc.caseStatus === 'CLOSED')?.userId

          if (originalAssignee) {
            updatedAssignments = [
              {
                assigneeUserId: originalAssignee,
                assignedByUserId: getContext()?.user?.id ?? '',
                timestamp: Date.now(),
              },
            ]
          }
        }

        const commentToPush: Comment = {
          body: comment,
          createdAt: Date.now(),
          files: update.files,
          id: uuid4(),
          updatedAt: Date.now(),
          userId: getContext()?.user?.id ?? '',
        }

        const checklistStatus = update.checklistStatus

        const acceptanceCriteriaPassed =
          update.checklistStatus === 'PASSED'
            ? await this.acceptanceCriteriaPassed({
                ruleChecklist: alert.ruleChecklist,
                ruleChecklistTemplateId: alert.ruleChecklistTemplateId,
              })
            : true

        if (!acceptanceCriteriaPassed) {
          throw new BadRequest(`Acceptance criteria not passed for alert`)
        }

        await withTransaction(async () => {
          await Promise.all([
            this.alertsRepository.updateAlertQaStatus(
              alert.alertId as string,
              checklistStatus,
              commentToPush,
              updatedAssignments
            ),
            this.alertsRepository.updateAlertQACountInSampling(
              alert,
              update.checklistStatus
            ),
          ])
        })
        auditLogEntities.push({
          entityId: alert.alertId as string,
          newImage: {
            qaStatus: update.checklistStatus,
            qaInfo: {
              reason: update.reason,
              comment: update.comment,
              files: update.files,
            },
          },
        })
      })

    if (update.checklistStatus === 'FAILED') {
      const alertIds = alerts.map((a) => a.alertId as string)

      promises.push(
        this.updateStatus(
          alertIds,
          {
            alertStatus: 'REOPENED',
            reason: update.reason,
            comment,
            files: update.files,
          },
          { cascadeCaseUpdates: true, bySystem: true, skipReview: true }
        ) // To systemeatically reopen the case
      )
    }

    await withTransaction(async () => {
      await Promise.all(promises)
    })

    return {
      result: undefined,
      entities: auditLogEntities,
    }
  }

  async updateAlertsQaAssignments(
    alertId: string,
    assignments: Assignment[]
  ): Promise<void> {
    const alert = await this.alertsRepository.getAlertById(alertId)

    if (!alert) {
      throw new NotFound('No alert')
    }

    await this.alertsRepository.updateAlertQaAssignments(
      alert.alertId as string,
      assignments
    )
  }

  private getQaSamplingFilters(filters: AlertParams): AlertParams {
    return {
      ...filters,
      filterAlertStatus: ['CLOSED'],
      filterQaStatus: "NOT_QA'd",
    }
  }

  async createAlertsQaSampling(
    data: AlertsQaSamplingRequest
  ): Promise<AlertsQaSampling> {
    let sample: Pick<
      AlertsQaSampling,
      'alertIds' | 'samplingQuantity' | 'samplingType' | 'filters'
    > | null = null

    const sampleId = await this.alertsRepository.getSampleIdForQA()
    if (data.samplingData.samplingType === 'MANUAL') {
      sample = {
        filters: {},
        samplingQuantity: data.samplingData.alertIds.length,
        samplingType: 'MANUAL',
        alertIds: data.samplingData.alertIds,
      }
    } else {
      const filters = data.samplingData.filters
      const queryParams: AlertParams = this.getQaSamplingFilters(filters)

      const query = await this.alertsRepository.getAlertsPipeline(queryParams, {
        excludeProject: true,
        hideTransactionIds: true,
        countOnly: true,
      })

      const sampleAlerts = await this.alertsRepository.getAlertsForQA(
        query,
        data.samplingData.samplingQuantity
      )

      sample = {
        filters: data.samplingData.filters,
        samplingQuantity: data.samplingData.samplingQuantity,
        alertIds: sampleAlerts.map((a) => a.alerts.alertId),
        samplingType: 'AUTOMATIC',
      }
    }

    return this.alertsRepository.saveQASampleData({
      ...sample,
      samplingId: `S-${sampleId.toString().padStart(3, '0')}`,
      createdAt: Date.now(),
      priority: data.priority,
      createdBy: getContext()?.user?.id ?? FLAGRIGHT_SYSTEM_USER,
      samplingDescription: data.samplingDescription,
      samplingName: data.samplingName,
      updatedAt: Date.now(),
    })
  }

  public async getSamplingData(
    params: DefaultApiGetAlertsQaSamplingRequest
  ): Promise<AlertQASamplingListResponse> {
    const data = await this.alertsRepository.getSamplingData(params)

    return {
      ...data,
      data: data.data.map((d) => {
        return omit(
          { ...d, numberOfAlerts: d?.alertIds?.length ?? 0 },
          'alertIds'
        )
      }),
    }
  }

  public async getSamplingById(samplingId: string): Promise<AlertsQaSampling> {
    const data = await this.alertsRepository.getSamplingDataById(samplingId)

    if (!data) {
      throw new NotFound('Sampling not found')
    }

    return { ...data, numberOfAlerts: data?.alertIds?.length ?? 0 }
  }

  public async getSamplingIds(): Promise<AlertsQASampleIds[]> {
    return this.alertsRepository.getSamplingIds()
  }

  public async deleteSamplingById(samplingId: string): Promise<void> {
    await this.alertsRepository.deleteSample(samplingId)
  }

  public async patchSamplingById(
    samplingId: string,
    data: AlertsQaSamplingUpdateRequest
  ): Promise<AlertsQaSampling> {
    const sampling = await this.getSamplingById(samplingId)

    let allAlertIds: string[] = []

    if (
      sampling.samplingType === 'AUTOMATIC' &&
      data?.samplingQuantity != null &&
      data.samplingQuantity > sampling.samplingQuantity
    ) {
      const alertsInSample = (sampling.alertIds ?? []).length

      const filters = this.getQaSamplingFilters(sampling.filters)

      const countOfAlertsRequired =
        (data.samplingQuantity || 0) -
        ((alertsInSample || 0) + (sampling?.numberOfAlertsQaDone || 0))

      const queryWithExcludedAlerts =
        await this.alertsRepository.getAlertsPipeline(
          {
            ...filters,
            excludeAlertIds: uniq(sampling?.alertIds ?? []),
          },
          {
            excludeProject: true,
            hideTransactionIds: true,
            countOnly: true,
          }
        )

      const newAlerts = await this.alertsRepository.getAlertsForQA(
        queryWithExcludedAlerts,
        countOfAlertsRequired
      )

      allAlertIds = uniq([
        ...(sampling?.alertIds ?? []),
        ...(newAlerts.map((a) => a.alerts.alertId) ?? []),
      ])
    }

    if (data.alertIds?.length) {
      allAlertIds = uniq([
        ...allAlertIds,
        ...(sampling?.alertIds ?? []),
        ...data.alertIds,
      ])
    }

    const updatedSampling: AlertsQaSampling = {
      ...sampling,
      ...data,
      manuallyAdded: data.alertIds?.length
        ? uniq([
            ...(sampling?.manuallyAdded ?? []),
            ...(sampling.samplingType === 'AUTOMATIC'
              ? difference(allAlertIds, sampling?.alertIds ?? [])
              : []),
          ])
        : sampling.manuallyAdded,
      updatedAt: Date.now(),
      alertIds: allAlertIds,
    }

    await this.alertsRepository.updateQASampleData(updatedSampling)

    return updatedSampling
  }

  public async closeAlertIfAllTransactionsApproved(
    alert: Alert,
    newlyApprovedTxIds: string[]
  ) {
    const dynamoDb = getDynamoDbClient()
    const transactionRepository = new DynamoDbTransactionRepository(
      this.tenantId,
      dynamoDb
    )
    const filteredTransactionIds = difference(
      alert.transactionIds,
      newlyApprovedTxIds
    )

    const allAllowed = await transactionRepository.checkTransactionStatus(
      filteredTransactionIds,
      (txns) => {
        return txns.every((txn) => txn.status === 'ALLOW')
      }
    )
    if (allAllowed && alert.alertId) {
      await this.updateStatus(
        [alert.alertId],
        {
          reason: ['Other'],
          comment: 'Alert status changed to closed',
          otherReason: ' All transactions of this alert are approved',
          alertStatus: 'CLOSED',
        },
        {
          bySystem: true,
        }
      )
    }
  }

  public async sendAlertOpenedWebhook(alerts: Alert[], cases: Case[]) {
    const webhookTasks: ThinWebhookDeliveryTask<AlertOpenedDetails>[] =
      alerts.map((alert) => {
        const alertCase = cases.find((c) =>
          c.alerts?.some((a) => a.alertId === alert.alertId)
        )
        return {
          event: 'ALERT_OPENED',
          triggeredBy: 'SYSTEM',
          entityId: alert.alertId as string,
          payload: {
            alertId: alert.alertId,
            status: alert.alertStatus,
            transactionIds: alert.transactionIds,
            ruleName: alert.ruleName,
            ruleDescription: alert.ruleDescription,
            ruleId: alert.ruleId,
            ruleInstanceId: alert.ruleInstanceId,
            userId:
              alertCase?.caseUsers?.origin?.userId ??
              alertCase?.caseUsers?.destination?.userId,
            caseId: alertCase?.caseId,
          },
        }
      })

    await sendWebhookTasks<AlertOpenedDetails>(this.tenantId, webhookTasks)
  }
}
