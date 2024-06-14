import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb'
import { MongoClient } from 'mongodb'
import createHttpError from 'http-errors'
import {
  compact,
  difference,
  isNil,
  memoize,
  omit,
  omitBy,
  pick,
  uniq,
} from 'lodash'

import { S3 } from '@aws-sdk/client-s3'
import { Credentials } from 'aws-lambda'
import { S3Config } from '../case-alerts-common'
import { CasesAlertsTransformer } from '../cases/cases-alerts-transformer'
import { CaseRepository, MAX_TRANSACTION_IN_A_CASE } from '../cases/repository'
import { MongoDbTransactionRepository } from '../rules-engine/repositories/mongodb-transaction-repository'
import { CasesAlertsAuditLogService } from '../cases/case-alerts-audit-log-service'
import { AlertsRepository } from './repository'
import { AlertsService } from '.'
import { traceable } from '@/core/xray'
import { Alert } from '@/@types/openapi-public-management/Alert'
import { Alert as AlertInternal } from '@/@types/openapi-internal/Alert'
import { Case as CaseInternal } from '@/@types/openapi-internal/Case'
import { AlertCreationRequest } from '@/@types/openapi-public-management/AlertCreationRequest'
import { PaymentMethod } from '@/@types/tranasction/payment-type'
import { CaseAggregates } from '@/@types/openapi-internal/CaseAggregates'
import { DEFAULT_CASE_AGGREGATES, generateCaseAggreates } from '@/utils/case'
import { CaseStatus } from '@/@types/openapi-internal/CaseStatus'
import { AlertUpdatable } from '@/@types/openapi-public-management/AlertUpdatable'
import { InternalTransaction } from '@/@types/openapi-internal/InternalTransaction'
import { statusEscalated } from '@/utils/helpers'
import { getExternalComment } from '@/utils/external-transformer'
import { CommentRequest as CommentRequestExternal } from '@/@types/openapi-public-management/CommentRequest'
import { CommentRequest } from '@/@types/openapi-internal/CommentRequest'
import { AlertStatusChangeRequest } from '@/@types/openapi-public-management/AlertStatusChangeRequest'
import { AlertStatusUpdateRequest } from '@/@types/openapi-internal/AlertStatusUpdateRequest'
@traceable
export class ExternalAlertManagementService {
  private alertsRepository: AlertsRepository
  private caseRepository: CaseRepository
  private transactionRepository: MongoDbTransactionRepository
  private alertsTransformer: CasesAlertsTransformer
  private casesAlertsAuditLogService: CasesAlertsAuditLogService
  private alertsInternalService: AlertsService

  constructor(
    tenantId: string,
    connections: { mongoDb: MongoClient; dynamoDb: DynamoDBDocumentClient },
    s3: S3,
    s3Config: S3Config,
    awsCredentials?: Credentials
  ) {
    this.alertsRepository = new AlertsRepository(tenantId, connections)
    this.caseRepository = new CaseRepository(tenantId, connections)
    this.transactionRepository = new MongoDbTransactionRepository(
      tenantId,
      connections.mongoDb
    )
    this.alertsTransformer = new CasesAlertsTransformer(tenantId, connections)
    this.casesAlertsAuditLogService = new CasesAlertsAuditLogService(
      tenantId,
      connections
    )
    this.alertsInternalService = new AlertsService(
      this.alertsRepository,
      s3,
      s3Config,
      awsCredentials
    )
  }

  private getCase = memoize(
    async (caseId: string) => {
      const case_ = await this.caseRepository.getCaseById(caseId, true)
      return case_
    },
    (caseId) => caseId
  )

  private getTransactions = memoize(
    async (transactionIds: string[]) => {
      const transactions =
        await this.transactionRepository.getTransactionsByIds(transactionIds)
      return transactions
    },
    (transactionIds) => transactionIds.join(',')
  )

  private async validateAlert(alert: AlertCreationRequest): Promise<void> {
    const alertId = alert.alertId

    if (!alertId) {
      throw new createHttpError.BadRequest(
        'Alert id missing in payload. Please provide an alert id'
      )
    }

    const alertIdRegex = /^A-\d+$/

    if (alertIdRegex.test(alertId)) {
      throw new createHttpError.BadRequest(
        `Alert id: ${alertId} not allowed for creation reserving A-{number} for internal alerts`
      )
    }

    if (alertId.length > 40) {
      throw new createHttpError.BadRequest(
        `Alert id: ${alertId} is too long. We only support alert ids upto 40 characters`
      )
    }

    const existingAlert = await this.alertsRepository.getAlertById(alertId)

    if (existingAlert) {
      throw new createHttpError.BadRequest(
        `Alert with id ${alertId} already exists under case ${existingAlert.caseId}`
      )
    }

    const caseId = alert.caseId

    if (!caseId) {
      throw new createHttpError.BadRequest(
        'Case id missing in payload. Please provide a case id'
      )
    }

    const existingCase = await this.getCase(caseId)

    if (!existingCase) {
      throw new createHttpError.BadRequest(
        `Case with id ${caseId} does not exist. Please provide a valid case id`
      )
    }

    if (alert.entityDetails.type === 'TRANSACTION') {
      const transactionIds = alert.entityDetails.transactionIds

      await this.validateTransactionIds(transactionIds)
    }
  }

  private async validateTransactionIds(
    transactionIds: string[] | undefined
  ): Promise<void> {
    if (!transactionIds) {
      throw new createHttpError.BadRequest(
        'Transaction ids missing in payload. Please provide transaction ids'
      )
    }

    if (transactionIds.length === 0) {
      throw new createHttpError.BadRequest(
        'Transaction ids array is empty. Please provide transaction ids'
      )
    }

    const uniqTransactionIds = uniq(transactionIds)

    const transactions = await this.transactionRepository.getTransactionsByIds(
      transactionIds
    )

    if (transactions.length !== uniqTransactionIds.length) {
      const missingTransactionIds = uniqTransactionIds.filter(
        (id) =>
          !transactions.find((transaction) => transaction.transactionId === id)
      )

      throw new createHttpError.BadRequest(
        `Transactions with ids ${missingTransactionIds.join(
          ', '
        )} not found in the system. Please create transactions with 'FRAML' api`
      )
    }
  }

  private generatePaymentMethods(transactions: InternalTransaction[]): {
    originPaymentMethods: PaymentMethod[]
    destinationPaymentMethods: PaymentMethod[]
  } {
    const originPaymentMethods = new Set<PaymentMethod>()
    const destinationPaymentMethods = new Set<PaymentMethod>()

    transactions.forEach((transaction) => {
      const originPaymentMethod = transaction.originPaymentDetails?.method
      const destinationPaymentMethod =
        transaction.destinationPaymentDetails?.method

      if (originPaymentMethod) {
        originPaymentMethods.add(originPaymentMethod)
      }

      if (destinationPaymentMethod) {
        destinationPaymentMethods.add(destinationPaymentMethod)
      }
    })

    return {
      originPaymentMethods: Array.from(originPaymentMethods),
      destinationPaymentMethods: Array.from(destinationPaymentMethods),
    }
  }

  private async transformCreationRequestToInternalAlert(
    requestBody: AlertCreationRequest
  ): Promise<{
    alert: AlertInternal
    caseAggregates: CaseAggregates
    caseTransactionsIds: string[]
  }> {
    const assignments: AlertInternal['assignments'] =
      await this.alertsTransformer.transformAssignmentsToInternal(
        requestBody.assignments || []
      )

    const entityDetails = requestBody.entityDetails
    const entityType = entityDetails.type

    const transactionIds: string[] =
      entityType === 'TRANSACTION' ? uniq(entityDetails.transactionIds) : []

    const case_ = (await this.getCase(requestBody.caseId)) as CaseInternal

    const caseAggregates = case_.caseAggregates
    const caseTransactionsIds = uniq([
      ...(case_.caseTransactionsIds ?? []),
      ...transactionIds,
    ])

    const transactions = await this.getTransactions(transactionIds)

    const numberOfTransactionsHit: number = transactionIds.length

    const { originPaymentMethods, destinationPaymentMethods } =
      this.generatePaymentMethods(transactions)

    const newCaseAggregates = generateCaseAggreates(
      transactions,
      caseAggregates
    )

    const alert: AlertInternal = {
      alertId: requestBody.alertId,
      createdTimestamp: requestBody.createdTimestamp,
      caseId: requestBody.caseId,
      priority: requestBody.priority,
      numberOfTransactionsHit,
      ruleAction: requestBody.ruleDetails.action,
      ruleDescription: requestBody.ruleDetails.description,
      ruleInstanceId: requestBody.ruleDetails.instanceId,
      ruleName: requestBody.ruleDetails.name,
      alertStatus: 'OPEN',
      creationReason: requestBody.creationReason,
      assignments,
      transactionIds,
      ruleId: requestBody.ruleDetails.id,
      tags: requestBody.tags,
      updatedAt: Date.now(),
      ruleNature: requestBody.ruleDetails.nature,
      originPaymentMethods: Array.from(originPaymentMethods),
      destinationPaymentMethods: Array.from(destinationPaymentMethods),
      createdTimestampInternal: Date.now(),
    }

    return { alert, caseAggregates: newCaseAggregates, caseTransactionsIds }
  }

  private async transformInternalAlertToExternalAlert(
    alert: AlertInternal
  ): Promise<Alert> {
    const assignments: Alert['assignments'] =
      await this.alertsTransformer.transformAssignmentsToExternalCase(
        alert.alertStatus as CaseStatus,
        alert
      )

    return {
      alertId: alert.alertId as string,
      alertStatus: this.alertsTransformer.getExternalCaseStatus(
        alert.alertStatus as CaseStatus
      ),
      caseId: alert.caseId as string,
      createdTimestamp: alert.createdTimestamp,
      entityDetails: alert.ruleHitMeta?.sanctionsDetails
        ? { type: 'SANCTIONS' }
        : {
            type: 'TRANSACTION',
            transactionIds: alert.transactionIds as string[],
          },
      priority: alert.priority,
      ruleDetails: {
        action: alert.ruleAction,
        description: alert.ruleDescription,
        id: alert.ruleId || '',
        instanceId: alert.ruleInstanceId,
        name: alert.ruleName,
        nature: alert.ruleNature || undefined,
      },
      updatedAt: alert.updatedAt || Date.now(),
      assignments,
      creationReason: alert.creationReason || undefined,
      tags: alert.tags || undefined,
    }
  }

  public async createAlert(requestBody: AlertCreationRequest): Promise<Alert> {
    await this.validateAlert(requestBody)

    const { alert, caseAggregates, caseTransactionsIds } =
      await this.transformCreationRequestToInternalAlert(requestBody)

    if (caseTransactionsIds.length > MAX_TRANSACTION_IN_A_CASE) {
      throw new createHttpError.BadRequest(
        `Cannot add more than ${MAX_TRANSACTION_IN_A_CASE} transactions to a case. Please create a new case`
      )
    }

    await this.alertsRepository.addAlertToMongo(alert.caseId as string, alert, {
      caseAggregates,
      caseTransactionsIds,
    })
    if (alert.alertId) {
      await this.transactionRepository.updateTransactionAlertIds(
        alert.transactionIds,
        [alert.alertId]
      )
    }
    const externalAlert = await this.transformInternalAlertToExternalAlert(
      alert
    )
    await this.casesAlertsAuditLogService.handleAuditLogForNewAlert(
      alert,
      'API_CREATION'
    )
    return externalAlert
  }

  public async getAlert(alertId: string): Promise<Alert> {
    const alert = await this.alertsRepository.getAlertById(alertId)

    if (!alert) {
      throw new createHttpError.NotFound(
        `Alert with id ${alertId} not found. Please provide a valid alert id`
      )
    }

    const externalAlert = await this.transformInternalAlertToExternalAlert(
      alert
    )

    return externalAlert
  }

  private async generateCaseDataForUpdate(
    alertUpdateId: string,
    case_: CaseInternal,
    updatedAlertTransactionIds: string[]
  ): Promise<{
    caseAggregates: CaseAggregates
    caseTransactionIds: string[]
  }> {
    const caseTransactionIds = compact(
      uniq([
        ...(case_.alerts
          ?.filter((alert) => alert.alertId !== alertUpdateId)
          ?.flatMap((alert) => alert.transactionIds) ?? []),
        ...updatedAlertTransactionIds,
      ])
    )

    const transactions = await this.getTransactions(caseTransactionIds)

    const caseAggregates = generateCaseAggreates(
      transactions,
      DEFAULT_CASE_AGGREGATES
    )

    return { caseAggregates, caseTransactionIds }
  }

  public async updateAlert(
    alertId: string,
    alert: AlertUpdatable
  ): Promise<Alert> {
    const existingAlert = await this.alertsRepository.getAlertById(alertId)

    if (!existingAlert) {
      throw new createHttpError.NotFound(
        `Alert with id ${alertId} not found. Please provide a valid alert id`
      )
    }

    const assignments = alert.assignments
      ? await this.alertsTransformer.transformAssignmentsToInternal(
          alert.assignments
        )
      : undefined

    const transactionIds =
      alert.entityDetails?.type === 'TRANSACTION'
        ? uniq(alert.entityDetails.transactionIds)
        : undefined

    let caseAggregates: CaseAggregates | undefined
    let caseTransactionIds: string[] | undefined
    let originPaymentMethods: PaymentMethod[] | undefined
    let destinationPaymentMethods: PaymentMethod[] | undefined

    if (transactionIds) {
      const transactions = await this.getTransactions(transactionIds)

      await this.validateTransactionIds(transactionIds)
      const case_ = await this.getCase(existingAlert.caseId as string)

      const [paymentMethods, caseData] = await Promise.all([
        this.generatePaymentMethods(transactions),
        this.generateCaseDataForUpdate(
          alertId,
          case_ as CaseInternal,
          transactionIds
        ),
      ])

      originPaymentMethods = paymentMethods.originPaymentMethods
      destinationPaymentMethods = paymentMethods.destinationPaymentMethods
      caseAggregates = caseData.caseAggregates
      caseTransactionIds = caseData.caseTransactionIds
      const transactionIdsRemoved = difference(
        existingAlert.transactionIds ?? [],
        transactionIds
      )
      await this.transactionRepository.removeTransactionAlertIds(
        transactionIdsRemoved,
        [alertId]
      )
      await this.transactionRepository.updateTransactionAlertIds(
        transactionIds,
        [alertId]
      )
    }

    if ((caseTransactionIds?.length ?? 0) > MAX_TRANSACTION_IN_A_CASE) {
      throw new createHttpError.BadRequest(
        `Cannot add more than ${MAX_TRANSACTION_IN_A_CASE} transactions to a case. Please create a new case`
      )
    }

    const alertUpdate: Partial<AlertInternal> = omitBy<Partial<AlertInternal>>(
      {
        priority: alert.priority,
        tags: alert.tags,
        ...(statusEscalated(existingAlert.alertStatus)
          ? { reviewAssignments: assignments }
          : { assignments }),
        creationReason: alert.creationReason,
        ruleNature: alert.ruleDetails?.nature,
        ruleAction: alert.ruleDetails?.action,
        ruleDescription: alert.ruleDetails?.description,
        ruleInstanceId: alert.ruleDetails?.instanceId,
        ruleName: alert.ruleDetails?.name,
        ruleId: alert.ruleDetails?.id,
        updatedAt: Date.now(),
        transactionIds: transactionIds,
        numberOfTransactionsHit: transactionIds?.length,
        originPaymentMethods,
        destinationPaymentMethods,
      },
      isNil
    )

    const updatedCaseData = await this.alertsRepository.updateAlertInMongo(
      existingAlert.caseId as string,
      alertId,
      alertUpdate,
      { caseAggregates, caseTransactionIds }
    )

    const oldImage = pick(existingAlert, Object.keys(alertUpdate))
    await this.casesAlertsAuditLogService.handleAuditLogForAlertUpdateViaApi(
      alertId,
      oldImage,
      alertUpdate
    )
    const externalAlert = await this.transformInternalAlertToExternalAlert(
      updatedCaseData.alerts?.find(
        (alert) => alert.alertId === alertId
      ) as AlertInternal
    )

    return externalAlert
  }

  public async getComments(alertId: string) {
    const comments = await this.alertsInternalService.getCommentsByAlertId(
      alertId
    )
    return comments.map((comment) => getExternalComment(comment))
  }

  public async getComment(alertId: string, commentId: string) {
    const comment = await this.alertsInternalService.getCommentByCommentId(
      alertId,
      commentId
    )
    return getExternalComment(comment)
  }

  public async saveAlertComment(
    alertId: string,
    comment: CommentRequestExternal
  ) {
    const commentInternal = await this.alertsInternalService.saveComment(
      alertId,
      omit(comment, ['createdAt']) as CommentRequest,
      true
    )
    return getExternalComment(commentInternal)
  }

  public async deleteAlertComment(alertId: string, commentId: string) {
    await this.alertsInternalService.deleteComment(alertId, commentId)
  }
  public async updateAlertStatus(
    updateRequest: AlertStatusChangeRequest,
    alertId: string
  ) {
    const alert = await this.alertsRepository.getAlertById(alertId)
    const status = updateRequest.status
    if (!alert) {
      throw new createHttpError.NotFound(
        `Alert with id ${alertId} not found. Please provide a valid alert id`
      )
    }
    const internalStatus = this.alertsTransformer.getInternalCaseStatus(status)
    if (internalStatus === alert.alertStatus) {
      throw new createHttpError.BadRequest(
        `Alert with id ${alertId} already in ${internalStatus} status`
      )
    }
    if (internalStatus === 'CLOSED' && !updateRequest.reason?.length) {
      throw new createHttpError.BadRequest(
        'Reason is required for closing an alert'
      )
    }
    const internalUpdateRequest: AlertStatusUpdateRequest = {
      reason: updateRequest.reason ?? [],
      alertStatus: internalStatus,
      otherReason: updateRequest.otherReason,
      comment: updateRequest.comment,
      files: updateRequest.files,
      alertCaseId: alert.caseId,
    }
    await this.alertsInternalService.updateStatus(
      [alertId],
      internalUpdateRequest,
      {
        bySystem: false,
        cascadeCaseUpdates: true,
        externalRequest: true,
        skipReview: true,
      }
    )
    return { alertStatus: (await this.getAlert(alertId)).alertStatus }
  }
}
