import {
  GetCommand,
  PutCommand,
  QueryCommandInput,
  GetCommandInput,
  DynamoDBDocumentClient,
} from '@aws-sdk/lib-dynamodb'
import { StackConstants } from '@lib/constants'
import compact from 'lodash/compact'
import concat from 'lodash/concat'
import omit from 'lodash/omit'
import {
  createUpdateCaseQueries,
  generateDynamoConsumerMessage,
  transactWriteWithClickhouse,
} from '../case-alerts-common/utils'
import { CaseWithoutCaseTransactions } from '../cases/repository'
import { SlaUpdates } from '../sla/sla-service'
import { Alert } from '@/@types/openapi-internal/Alert'
import { Assignment } from '@/@types/openapi-internal/Assignment'
import { CaseStatusChange } from '@/@types/openapi-internal/CaseStatusChange'
import { Comment } from '@/@types/openapi-internal/Comment'
import { DynamoDbKeys } from '@/core/dynamodb/dynamodb-keys'
import {
  batchGet,
  sanitizeMongoObject,
  TransactWriteOperation,
  paginateQuery,
  getUpdateAttributesUpdateItemInput,
  dangerouslyDeletePartitionKey,
  dangerouslyDeletePartition,
  dangerouslyQueryPaginateDelete,
  DynamoTransactionBatch,
  BatchWriteRequestInternal,
} from '@/utils/dynamodb'
import { FileInfo } from '@/@types/openapi-internal/FileInfo'
import {
  DynamoConsumerMessage,
  dynamoKey,
  dynamoKeyList,
} from '@/@types/dynamo'
import { CLICKHOUSE_DEFINITIONS } from '@/constants/clickhouse/definitions'
import { logger } from '@/core/logger'
import { ChecklistItemValue } from '@/@types/openapi-internal/ChecklistItemValue'
import { ChecklistStatus } from '@/@types/openapi-internal/ChecklistStatus'
import { getContext } from '@/core/utils/context-storage'
import { Account } from '@/@types/openapi-internal/Account'
import { CaseAggregates } from '@/@types/openapi-internal/CaseAggregates'
import { traceable } from '@/core/xray'
import {
  AlertCommentFileInternal,
  AlertCommentsInternal,
  SanctionsDetailsInternal,
} from '@/@types/alert/AlertsInternal'
import { AlertsQaSampling } from '@/@types/openapi-internal/AlertsQaSampling'
import { getClickhouseClient } from '@/utils/clickhouse/client'
import { envIs } from '@/utils/env'
import { removeUndefinedFields } from '@/utils/object'
import { ClickhouseTableNames } from '@/@types/clickhouse/table-names'
import { SanctionsDetails } from '@/@types/openapi-internal/SanctionsDetails'

type caseUpdateOptions = {
  updateCase: boolean
  caseUpdateFields: Record<string, any>
}

@traceable
export class DynamoAlertRepository {
  private readonly tenantId: string
  private readonly dynamoDb: DynamoDBDocumentClient
  private readonly tableName: string
  private readonly AlertsQaSamplingTableName: ClickhouseTableNames
  private readonly CasesClickhouseTableName: ClickhouseTableNames
  private readonly AlertsClickhouseTableName: ClickhouseTableNames

  constructor(tenantId: string, dynamoDb: DynamoDBDocumentClient) {
    this.tenantId = tenantId
    this.dynamoDb = dynamoDb
    this.tableName = StackConstants.TARPON_DYNAMODB_TABLE_NAME(this.tenantId)
    this.CasesClickhouseTableName = CLICKHOUSE_DEFINITIONS.CASES_V2.tableName
    this.AlertsClickhouseTableName = CLICKHOUSE_DEFINITIONS.ALERTS.tableName
    this.AlertsQaSamplingTableName =
      CLICKHOUSE_DEFINITIONS.ALERTS_QA_SAMPLING.tableName
  }

  public async saveAlertsForCase(
    alerts: Alert[],
    caseId: string,
    batch?: DynamoTransactionBatch
  ): Promise<dynamoKeyList> {
    if (!alerts || alerts.length === 0) {
      return []
    }
    const alertKeys: dynamoKeyList = []
    const shouldExecute = !batch

    if (!batch) {
      // Create document client and batch for operations

      batch = new DynamoTransactionBatch(this.dynamoDb, this.tableName)

      // Add case update
      const caseKey = DynamoDbKeys.CASE(this.tenantId, caseId)
      batch.update({
        Key: caseKey,
        UpdateExpression: 'SET updatedAt = :updatedAt',
        ExpressionAttributeValues: {
          ':updatedAt': Date.now(),
        },
      })
    }

    for (const alert of alerts) {
      const alertId = alert.alertId as string
      logger.debug(`Saving alert ${alertId} to DynamoDB`)
      const key = DynamoDbKeys.ALERT(this.tenantId, alertId)
      const caseAlertKey = DynamoDbKeys.CASE_ALERT(
        this.tenantId,
        caseId,
        alertId
      )

      let alertToSave = { ...alert }
      const comments = alertToSave.comments || []

      alertToSave = omit(alertToSave, ['comments', 'transactionIds'])

      if (alertToSave.ruleHitMeta?.sanctionsDetails) {
        alertToSave.ruleHitMeta = omit(alertToSave.ruleHitMeta, [
          'sanctionsDetails',
        ])
      }

      // Add alert to both the keys
      batch.put({
        Item: {
          ...key,
          ...sanitizeMongoObject(alertToSave),
        },
      })
      batch.put({
        Item: {
          ...caseAlertKey,
          ...sanitizeMongoObject(alertToSave),
        },
      })

      alertKeys.push({ key })

      // Add alert comments if they exist
      await this.saveCommentsForAlert(alertId, comments, batch)

      // Add alert sanctions details if they exist
      await this.saveSanctionsDetailsForAlert(
        alertId,
        alert.ruleHitMeta?.sanctionsDetails,
        batch
      )

      // Add alert transaction ids if they exist
      await this.saveTransactionIds(alertId, alert.transactionIds, batch)
    }

    const message: DynamoConsumerMessage[] = generateDynamoConsumerMessage(
      this.tenantId,
      [{ keyLists: alertKeys, tableName: this.AlertsClickhouseTableName }]
    )

    if (shouldExecute) {
      await batch.executeWithClickhouse(message)
      return []
    }
    return alertKeys
  }

  public async saveCommentsForAlert(
    alertId: string,
    comments: Comment[],
    batch?: DynamoTransactionBatch
  ): Promise<void> {
    if (!comments || comments.length === 0) {
      return
    }

    const shouldExecute = !batch
    let keyLists: dynamoKeyList = []
    let caseKeyLists: dynamoKeyList = []

    if (!batch) {
      // Create document client and batch for operations

      batch = new DynamoTransactionBatch(this.dynamoDb, this.tableName)

      const {
        writeRequests: alertWriteRequests,
        keyLists: alertKeyLists,
        caseKeyLists: caseAlertKeyLists,
      } = await this.prepareAlertUpdates(alertId)

      // Add alert update operations to batch
      for (const request of alertWriteRequests) {
        if (request.Put) {
          batch.put({ Item: request.Put.Item })
        } else if (request.Update) {
          batch.update({
            Key: request.Update.Key,
            UpdateExpression: request.Update.UpdateExpression,
            ExpressionAttributeValues: request.Update.ExpressionAttributeValues,
          })
        }
      }

      keyLists = alertKeyLists
      caseKeyLists = caseAlertKeyLists
    }

    for (const comment of comments) {
      const commentKey = DynamoDbKeys.ALERT_COMMENT(
        this.tenantId,
        alertId,
        comment.id as string
      )

      let commentToSave = { ...comment, alertId }
      const files = commentToSave.files || []
      commentToSave = omit(commentToSave, ['files'])

      batch.put({
        Item: {
          ...commentKey,
          ...commentToSave,
        },
      })

      // Add comment files if they exist
      await this.saveCommentsFilesForAlert(
        alertId,
        comment.id as string,
        files,
        batch
      )
    }

    if (shouldExecute) {
      const dynamoDbConsumerMessage: DynamoConsumerMessage[] =
        generateDynamoConsumerMessage(this.tenantId, [
          { keyLists: keyLists, tableName: this.AlertsClickhouseTableName },
          { keyLists: caseKeyLists, tableName: this.CasesClickhouseTableName },
        ])
      await batch.executeWithClickhouse(dynamoDbConsumerMessage)
    }
  }

  /**
   * Saves sanctions details for an alert
   *
   * @param alertId The ID of the alert to save the sanctions details for
   * @param sanctionsDetails The sanctions details to save
   * @param batch The batch to save the sanctions details to
   * @returns Promise that resolves when the sanctions details are saved
   */
  public async saveSanctionsDetailsForAlert(
    alertId: string,
    sanctionsDetails?: SanctionsDetails[],
    batch?: DynamoTransactionBatch
  ): Promise<void> {
    if (!sanctionsDetails || sanctionsDetails.length === 0) {
      return
    }
    if (batch) {
      for (const sanctionsDetail of sanctionsDetails) {
        const key = DynamoDbKeys.ALERT_SANCTIONS_DETAILS(
          this.tenantId,
          alertId,
          sanctionsDetail.searchId,
          sanctionsDetail.hitContext?.paymentMethodId,
          sanctionsDetail.entityType
        )
        batch.put({
          Item: {
            ...key,
            ...sanctionsDetail,
            alertId,
          },
        })
      }
    } else {
      const newBatch = new DynamoTransactionBatch(this.dynamoDb, this.tableName)
      for (const sanctionsDetail of sanctionsDetails) {
        const key = DynamoDbKeys.ALERT_SANCTIONS_DETAILS(
          this.tenantId,
          alertId,
          sanctionsDetail.searchId,
          sanctionsDetail.hitContext?.paymentMethodId,
          sanctionsDetail.entityType
        )
        newBatch.put({
          Item: {
            ...key,
            ...sanctionsDetail,
            alertId,
          },
        })
      }
      await newBatch.execute()
    }
  }

  /**
   * Updates the SLA policy details for a alert
   *
   * @param alertId - The ID of the alert to update
   * @param slaPolicyDetails - The updated SLA policy details array
   *
   * We are not updating the updatedAt field here because we make the SLAPolicyDetails update
   * from our end and we do not want to make the user confused if they have not updated the object.
   *  - Jayant Patil "Saheb"
   * @returns Promise that resolves when the update is complete
   */
  public async updateAlertSlaPolicyDetails(
    updates: SlaUpdates[]
  ): Promise<void> {
    const now = Date.now()

    const updateExpression = `SET slaPolicyDetails = :slaPolicyDetails, updatedAt = :updatedAt`

    const alertIds = updates.map((update) => update.entityId)
    const alertItems = await this.getAlertsFromAlertIds(alertIds)
    if (!alertItems) {
      throw new Error(`Alert with ID ${alertIds} not found`)
    }
    let operations: TransactWriteOperation[] = []
    let keyLists: dynamoKeyList = []
    for (const update of updates) {
      const targetAlert = alertItems.find(
        (item) => item.alertId === update.entityId
      )
      if (!targetAlert) {
        continue
      }
      const expressionAttributeValues = {
        ':slaPolicyDetails': update.slaPolicyDetails,
        ':updatedAt': now,
      }
      const { operations: alertOperations, keyLists: alertKeyLists } =
        await this.createAlertUpdatesQueries(
          update.entityId,
          updateExpression,
          expressionAttributeValues,
          targetAlert
        )
      operations = concat(operations, alertOperations)
      keyLists = concat(keyLists, alertKeyLists)
    }
    const dynamoDbConsumerMessage: DynamoConsumerMessage[] =
      generateDynamoConsumerMessage(this.tenantId, [
        { keyLists: keyLists, tableName: this.AlertsClickhouseTableName },
      ])

    await transactWriteWithClickhouse(
      this.dynamoDb,
      operations,
      dynamoDbConsumerMessage
    )

    logger.debug(`Updated SLA policy details for given alerts`)
  }

  public async saveCommentsFilesForAlert(
    alertId: string,
    commentId: string,
    files: FileInfo[],
    batch?: DynamoTransactionBatch
  ): Promise<void> {
    if (!files || files.length === 0) {
      return
    }

    const now = Date.now()
    const shouldExecute = !batch
    let keyLists: dynamoKeyList = []
    let caseKeyLists: dynamoKeyList = []

    // Create or use existing batch
    let activeBatch: DynamoTransactionBatch
    if (!batch) {
      // Create document client and batch for operations

      activeBatch = new DynamoTransactionBatch(this.dynamoDb, this.tableName)

      // Get timestamp update requests
      const {
        writeRequests: alertWriteRequests,
        keyLists: alertKeyLists,
        caseKeyLists: caseAlertKeyLists,
      } = await this.prepareAlertUpdates(alertId)

      // Add alert update operations to batch
      for (const request of alertWriteRequests) {
        if (request.Put) {
          activeBatch.put({ Item: request.Put.Item })
        } else if (request.Update) {
          activeBatch.update({
            Key: request.Update.Key,
            UpdateExpression: request.Update.UpdateExpression,
            ExpressionAttributeValues: request.Update.ExpressionAttributeValues,
          })
        }
      }

      keyLists = alertKeyLists
      caseKeyLists = caseAlertKeyLists

      const commentKey = DynamoDbKeys.ALERT_COMMENT(
        this.tenantId,
        alertId,
        commentId
      )
      activeBatch.put({
        Item: {
          ...commentKey,
          updatedAt: now,
        },
      })
    } else {
      activeBatch = batch
    }

    // Add all files
    files.forEach((file) => {
      const fileKey = DynamoDbKeys.ALERT_COMMENT_FILE(
        this.tenantId,
        alertId,
        commentId,
        file.s3Key
      )
      activeBatch.put({
        Item: {
          ...fileKey,
          ...file,
          alertId,
          commentId,
        },
      })
    })

    if (shouldExecute) {
      const dynamoDbConsumerMessage: DynamoConsumerMessage[] =
        generateDynamoConsumerMessage(this.tenantId, [
          { keyLists: keyLists, tableName: this.AlertsClickhouseTableName },
          { keyLists: caseKeyLists, tableName: this.CasesClickhouseTableName },
        ])

      await activeBatch.executeWithClickhouse(dynamoDbConsumerMessage)
    }
  }

  /**
   * Saves transaction IDs to DynamoDB in a different partition
   *
   * @param alertId - The ID of the alert to save the transaction IDs for
   * @param transactionIds - Array of transaction IDs to save
   * @returns Promise resolving to write operations
   */
  public async saveTransactionIds(
    alertId: string,
    transactionIds?: string[],
    batch?: DynamoTransactionBatch
  ): Promise<void> {
    if (!transactionIds || transactionIds.length === 0) {
      return
    }
    const key = DynamoDbKeys.ALERT_TRANSACTION_IDS(this.tenantId, alertId)

    if (batch) {
      // Add to existing batch
      batch.put({
        Item: {
          ...key,
          transactionIds,
          alertId,
        },
      })
    } else {
      // Create new batch only if none provided
      const newBatch = new DynamoTransactionBatch(this.dynamoDb, this.tableName)
      newBatch.put({
        Item: {
          ...key,
          transactionIds,
          alertId,
        },
      })
      await newBatch.execute()
    }
  }

  /**
   * Updates the checklist status for a alert
   * @param alertId - The ID of the alert to update
   * @param updatedChecklist - The updated checklist status array
   * @returns Promise that resolves when the update is complete
   */
  public async updateAlertChecklistStatus(
    alertId: string,
    updatedChecklist: ChecklistItemValue[]
  ): Promise<void> {
    const updateExpressionRecord = {
      ruleChecklist: updatedChecklist,
      updatedAt: Date.now(),
    }
    const { writeRequests, keyLists, caseKeyLists } =
      await this.prepareAlertUpdates(alertId, updateExpressionRecord)
    const dynamoDbConsumerMessage: DynamoConsumerMessage[] =
      generateDynamoConsumerMessage(this.tenantId, [
        { keyLists: keyLists, tableName: this.AlertsClickhouseTableName },
        { keyLists: caseKeyLists, tableName: this.CasesClickhouseTableName },
      ])

    await transactWriteWithClickhouse(
      this.dynamoDb,
      writeRequests,
      dynamoDbConsumerMessage
    )
  }

  /**
   * Get a case by its ID from DynamoDB
   *
   * @param caseId - The ID of the case to retrieve
   * @returns Promise resolving to the case or undefined if not found
   */
  public async getCaseById(
    caseId: string,
    projectionExpression?: string
  ): Promise<CaseWithoutCaseTransactions | undefined> {
    const key = DynamoDbKeys.CASE(this.tenantId, caseId)
    const commandInput: GetCommandInput = {
      TableName: this.tableName,
      Key: key,
    }
    if (projectionExpression) {
      commandInput.ProjectionExpression = projectionExpression
    }
    const command = new GetCommand(commandInput)

    const commandResult = await this.dynamoDb.send(command)
    if (!commandResult.Item) {
      return undefined
    }
    const caseItem = commandResult.Item as CaseWithoutCaseTransactions
    return omit(caseItem, [
      'PartitionKeyID',
      'SortKeyID',
    ]) as CaseWithoutCaseTransactions
  }

  /**
   * Add alerts to a case
   * @param caseId - The ID of the case to save alerts for
   * @param alerts - The alerts to save
   * @returns Promise that resolves when the alerts are saved
   */
  public async addAlertToDynamo(
    caseId: string,
    alert: Alert,
    caseData: { caseAggregates: CaseAggregates; caseTransactionsIds: string[] }
  ): Promise<void> {
    const { caseAggregates, caseTransactionsIds } = caseData
    const caseItem = await this.getCaseById(
      caseId,
      'caseSubjectIdentifiers,createdTimestamp'
    )
    if (!caseItem) {
      throw new Error(`Case with ID ${caseId} not found`)
    }
    alert.caseSubjectIdentifiers = caseItem.caseSubjectIdentifiers
    alert.caseCreatedTimestamp = caseItem.createdTimestamp

    // Create document client and batch for operations

    const batch = new DynamoTransactionBatch(this.dynamoDb, this.tableName)

    const alertsKeyLists = await this.saveAlertsForCase([alert], caseId, batch)

    const updateCaseExpression = `SET caseAggregates = :caseAggregates, caseTransactionsIds = :caseTransactionsIds, caseTransactionsCount = :caseTransactionsCount`
    const updateCaseExpressionAttributeValues = {
      ':caseAggregates': caseAggregates,
      ':caseTransactionsIds': caseTransactionsIds,
      ':caseTransactionsCount': caseTransactionsIds.length,
    }
    const { operations: caseWriteRequests, keyLists: caseKeyLists } =
      await createUpdateCaseQueries(this.tenantId, this.tableName, {
        caseId,
        UpdateExpression: updateCaseExpression,
        ExpressionAttributeValues: updateCaseExpressionAttributeValues,
        caseItem: caseItem,
        identifiers: alert.caseSubjectIdentifiers,
      })

    // Add case operations to batch
    for (const operation of caseWriteRequests) {
      if (operation.Put) {
        batch.put({ Item: operation.Put.Item })
      } else if (operation.Update) {
        batch.update({
          Key: operation.Update.Key,
          UpdateExpression: operation.Update.UpdateExpression,
          ExpressionAttributeValues: operation.Update.ExpressionAttributeValues,
        })
      }
    }

    const dynamoDbConsumerMessage: DynamoConsumerMessage[] =
      generateDynamoConsumerMessage(this.tenantId, [
        { keyLists: caseKeyLists, tableName: this.CasesClickhouseTableName },
      ])
    if (alertsKeyLists.length > 0) {
      dynamoDbConsumerMessage.push({
        tenantId: this.tenantId,
        tableName: this.AlertsClickhouseTableName,
        items: alertsKeyLists,
      })
    }

    await batch.executeWithClickhouse(dynamoDbConsumerMessage)
  }

  /**
   * Updates the QA status for a alert
   * @param alertId - The ID of the alert to update
   * @param qaStatus - The updated QA status
   * @param comment - The comment to associate with the QA status
   * @param assignments - Optional new assignments to set
   * @returns Promise that resolves when the update is complete
   */
  public async updateAlertQaStatus(
    alertId: string,
    qaStatus: ChecklistStatus,
    comment: Comment,
    assignments?: Assignment[]
  ): Promise<void> {
    const updateExpressionRecord = {
      ruleQaStatus: qaStatus,
      assignments: assignments,
      updatedAt: Date.now(),
    }

    // Create document client and batch for operations

    const batch = new DynamoTransactionBatch(this.dynamoDb, this.tableName)

    const {
      writeRequests: alertWriteRequests,
      keyLists,
      caseKeyLists,
    } = await this.prepareAlertUpdates(alertId, updateExpressionRecord)

    // Add alert update operations to batch
    for (const request of alertWriteRequests) {
      if (request.Put) {
        batch.put({ Item: request.Put.Item })
      } else if (request.Update) {
        batch.update({
          Key: request.Update.Key,
          UpdateExpression: request.Update.UpdateExpression,
          ExpressionAttributeValues: request.Update.ExpressionAttributeValues,
        })
      }
    }

    // Add comment to batch
    await this.saveCommentsForAlert(alertId, [comment], batch)

    const dynamoDbConsumerMessage: DynamoConsumerMessage[] =
      generateDynamoConsumerMessage(this.tenantId, [
        { keyLists: keyLists, tableName: this.AlertsClickhouseTableName },
        { keyLists: caseKeyLists, tableName: this.CasesClickhouseTableName },
      ])

    await batch.executeWithClickhouse(dynamoDbConsumerMessage)
  }

  /**
   * Updates the QA assignments for a alert
   * @param alertId - The ID of the alert to update
   * @param assignments - The updated QA assignments
   * @returns Promise that resolves when the update is complete
   */
  public async updateAlertQaAssignments(
    alertId: string,
    assignments: Assignment[]
  ): Promise<void> {
    const updateExpressionRecord = {
      qaAssignment: assignments,
      updatedAt: Date.now(),
    }
    const { writeRequests, keyLists, caseKeyLists } =
      await this.prepareAlertUpdates(alertId, updateExpressionRecord)
    const dynamoDbConsumerMessage: DynamoConsumerMessage[] =
      generateDynamoConsumerMessage(this.tenantId, [
        { keyLists: keyLists, tableName: this.AlertsClickhouseTableName },
        { keyLists: caseKeyLists, tableName: this.CasesClickhouseTableName },
      ])
    await transactWriteWithClickhouse(
      this.dynamoDb,
      writeRequests,
      dynamoDbConsumerMessage
    )
  }

  /**
   * Updates the AI summary of a file in a comment
   *
   * @param alertId - The ID of the alert containing the comment
   * @param commentId - The ID of the comment containing the file
   * @param fileS3Key - The S3 key of the file to update
   * @param summary - The AI summary to set for the file
   * @returns Promise that resolves when the update is complete
   */
  public async updateAISummary(
    alertId: string,
    commentId: string,
    fileS3Key: string,
    summary: string
  ) {
    const fileKey = DynamoDbKeys.ALERT_COMMENT_FILE(
      this.tenantId,
      alertId,
      commentId,
      fileS3Key
    )

    const fileUpdateOperation: TransactWriteOperation = {
      Update: {
        TableName: this.tableName,
        Key: fileKey,
        UpdateExpression: 'SET aiSummary = :aiSummary, updatedAt = :updatedAt',
        ExpressionAttributeValues: {
          ':aiSummary': summary,
          ':updatedAt': Date.now(),
        },
      },
    }

    return this.prepareAlertUpdates(alertId).then(
      ({ writeRequests, keyLists, caseKeyLists }) => {
        const operations = [...writeRequests, fileUpdateOperation]

        const dynamoDbConsumerMessage: DynamoConsumerMessage[] =
          generateDynamoConsumerMessage(this.tenantId, [
            { keyLists: keyLists, tableName: this.AlertsClickhouseTableName },
            {
              keyLists: caseKeyLists,
              tableName: this.CasesClickhouseTableName,
            },
          ])

        if (operations.length > 0) {
          return transactWriteWithClickhouse(
            this.dynamoDb,
            operations,
            dynamoDbConsumerMessage
          )
        }
      }
    )
  }

  /**
   * Prepares update operations for an alert and its case and its auxiliary indexes
   * @param alertId The ID of the alert to update
   * @param updateFields fields to update (beyond updatedAt)
   * @returns Array of operations to use with transactWrite
   */
  async prepareAlertUpdates(
    alertId: string,
    updateFields: Record<string, any> = {},
    alertItem?: Alert,
    options: caseUpdateOptions = {
      updateCase: true,
      caseUpdateFields: { updatedAt: Date.now() },
    }
  ): Promise<{
    writeRequests: TransactWriteOperation[]
    keyLists: dynamoKeyList
    caseKeyLists: dynamoKeyList
  }> {
    const now = Date.now()

    const fieldsToUpdate = {
      ...updateFields,
      updatedAt: now,
    }
    if (!alertItem) {
      alertItem = await this.getAlert(alertId)
    }
    if (!alertItem) {
      throw new Error(`Alert with ID ${alertId} not found`)
    }
    const caseId = alertItem.caseId as string
    const identifiers = alertItem.caseSubjectIdentifiers

    const { UpdateExpression, ExpressionAttributeValues } =
      getUpdateAttributesUpdateItemInput(fieldsToUpdate)
    let operations: TransactWriteOperation[] = []
    const { operations: writeRequests, keyLists } =
      await this.createAlertUpdatesQueries(
        alertId,
        UpdateExpression,
        ExpressionAttributeValues,
        alertItem
      )
    operations = concat(operations, writeRequests)
    let caseKeyLists: dynamoKeyList = []
    if (options.updateCase) {
      const {
        UpdateExpression: caseUpdateExpression,
        ExpressionAttributeValues: caseUpdateExpressionAttributeValues,
      } = getUpdateAttributesUpdateItemInput(options.caseUpdateFields)
      const { operations: caseOperations, keyLists: caseKeyListsTemp } =
        await createUpdateCaseQueries(this.tenantId, this.tableName, {
          caseId,
          UpdateExpression: caseUpdateExpression,
          ExpressionAttributeValues: caseUpdateExpressionAttributeValues,
          identifiers: identifiers,
        })
      operations = concat(operations, caseOperations)
      caseKeyLists = concat(caseKeyLists, caseKeyListsTemp)
    }
    return { writeRequests: operations, keyLists, caseKeyLists }
  }

  private async createAlertUpdatesQueries(
    alertId: string,
    UpdateExpression: string,
    ExpressionAttributeValues: Record<string, any>,
    alertItem: Alert
  ) {
    const operations: TransactWriteOperation[] = []
    const keyLists: dynamoKeyList = []

    const mainKey = DynamoDbKeys.ALERT(this.tenantId, alertId)
    operations.push({
      Update: {
        TableName: this.tableName,
        Key: mainKey,
        UpdateExpression,
        ExpressionAttributeValues,
      },
    })

    keyLists.push({
      key: mainKey,
    })
    const auxiliaryIndexes = this.getAlertAuxiliaryIndexes(alertId, alertItem)
    for (const index of auxiliaryIndexes) {
      operations.push({
        Update: {
          TableName: this.tableName,
          Key: {
            PartitionKeyID: index.PartitionKeyID,
            SortKeyID: index.SortKeyID,
          },
          UpdateExpression,
          ExpressionAttributeValues,
        },
      })
    }

    return { operations, keyLists }
  }

  private getAlertAuxiliaryIndexes(alertId: string, alertItem: Alert) {
    const caseId = alertItem.caseId as string
    const indexes: dynamoKey[] = []
    const caseAlertKey = DynamoDbKeys.CASE_ALERT(
      this.tenantId,
      caseId,
      alertId
    ) as dynamoKey
    indexes.push(caseAlertKey)
    return indexes
  }

  public async saveAlert(alert: Alert): Promise<void> {
    const alertId = alert.alertId as string
    const key = DynamoDbKeys.ALERT(this.tenantId, alertId)

    let alertToSave = { ...alert }
    const comments = alertToSave.comments || []
    alertToSave = omit(alert, ['comments', 'transactionIds'])

    if (alert.ruleHitMeta?.sanctionsDetails) {
      alert.ruleHitMeta = omit(alert.ruleHitMeta, ['sanctionsDetails'])
    }

    await this.dynamoDb.send(
      new PutCommand({
        TableName: StackConstants.TARPON_DYNAMODB_TABLE_NAME(this.tenantId),
        Item: {
          ...key,
          ...alertToSave,
        },
      })
    )

    // Add alert comments if they exist
    await this.saveCommentsForAlert(alertId, comments)

    // Add alert sanctions details if they exist
    await this.saveSanctionsDetailsForAlert(
      alertId,
      alert.ruleHitMeta?.sanctionsDetails
    )

    // Add alert transaction ids if they exist
    await this.saveTransactionIds(alertId, alert.transactionIds)
  }

  /**
   * Save the same comment for multiple alerts
   * Not saving the updatedAt here as it will be anyways saved in the updateStatus method
   * @param alertIds - Array of alert IDs to save the comment for
   * @param comment - The comment to save
   */
  public async saveAlertsComment(
    alertIds: string[],
    comment: Comment
  ): Promise<void> {
    // Create document client and batch for operations

    const batch = new DynamoTransactionBatch(this.dynamoDb, this.tableName)

    // Add all comments to batch
    for (const alertId of alertIds) {
      await this.saveCommentsForAlert(alertId, [comment], batch)
    }

    // Execute batch if it has operations
    if (batch.getRequestCount() > 0) {
      await batch.execute()
    }
  }

  /**
   * Soft deletes a comment and its child comments by setting the 'deletedAt' timestamp.
   * Also updates the 'updatedAt' timestamp on the parent case and its auxiliary items.
   *
   * @param alertId - The ID of the alert containing the comment.
   * @param commentId - The ID of the comment to delete.
   */
  public async deleteAlertComment(
    alertId: string,
    commentId: string
  ): Promise<void> {
    const now = Date.now()

    const commentPartitionKey = DynamoDbKeys.ALERT_COMMENT(
      this.tenantId,
      alertId,
      ''
    ).PartitionKeyID

    const queryInput: QueryCommandInput = {
      TableName: this.tableName,
      KeyConditionExpression: 'PartitionKeyID = :pk',
      ExpressionAttributeValues: {
        ':pk': commentPartitionKey,
      },
    }

    const result = await paginateQuery(this.dynamoDb, queryInput)
    const allComments = result.Items || []

    const commentsToDelete = allComments.filter(
      (comment) => comment.id === commentId || comment.parentId === commentId
    )

    if (commentsToDelete.length === 0) {
      logger.warn(
        `No comments found with id or parentId ${commentId} in alert ${alertId}`
      )
      return
    }

    let operations: TransactWriteOperation[] = []

    commentsToDelete.forEach((comment) => {
      const commentKey = DynamoDbKeys.ALERT_COMMENT(
        this.tenantId,
        alertId,
        comment.id
      )

      operations.push({
        Update: {
          TableName: this.tableName,
          Key: commentKey,
          UpdateExpression:
            'SET deletedAt = :deletedAt, updatedAt = :updatedAt',
          ExpressionAttributeValues: {
            ':deletedAt': now,
            ':updatedAt': now,
          },
        },
      })
    })

    const { writeRequests, keyLists, caseKeyLists } =
      await this.prepareAlertUpdates(alertId, {
        updatedAt: now,
      })

    operations = [...operations, ...writeRequests]

    const dynamoDbConsumerMessage: DynamoConsumerMessage[] =
      generateDynamoConsumerMessage(this.tenantId, [
        { keyLists: keyLists, tableName: this.AlertsClickhouseTableName },
        { keyLists: caseKeyLists, tableName: this.CasesClickhouseTableName },
      ])
    await transactWriteWithClickhouse(
      this.dynamoDb,
      operations,
      dynamoDbConsumerMessage
    )
  }

  /**
   * Updates the status of multiple alerts
   *
   * @param alertIds - Array of alert IDs to update
   * @param statusChange - The new status change to set
   * @param isLastInReview - Optional flag indicating if the status change is the last in review
   */
  public async updateStatus(
    alertIds: string[],
    statusChange: CaseStatusChange,
    isLastInReview?: boolean
  ) {
    const now = Date.now()

    const caseIdsSet = new Map<string, string[]>()
    const operationsAndKeyLists = await Promise.all(
      alertIds.map(async (alertId) => {
        const alertItem = await this.getAlert(alertId)
        if (!alertItem) {
          return { operations: [], keyLists: [] }
        }
        caseIdsSet.set(
          alertItem.caseId as string,
          alertItem.caseSubjectIdentifiers as string[]
        )

        const statusChangeItem = {
          ...statusChange,
          userId: isLastInReview
            ? alertItem?.lastStatusChange?.userId
            : statusChange.userId,
          reviewerId: isLastInReview ? statusChange.userId : undefined,
          timestamp: now,
        }

        const updateExpression = `
          SET 
            alertStatus = :alertStatus,
            lastStatusChange = :lastStatusChange,
            updatedAt = :updatedAt,
            statusChanges = list_append(if_not_exists(statusChanges, :emptyList), :statusChange)
        `
        const expressionAttributeValues = removeUndefinedFields({
          ':alertStatus': statusChange.caseStatus,
          ':lastStatusChange': statusChangeItem,
          ':updatedAt': now,
          ':statusChange': [statusChangeItem],
          ':emptyList': [],
        })

        return await this.createAlertUpdatesQueries(
          alertId,
          updateExpression,
          expressionAttributeValues,
          alertItem
        )
      })
    )
    const operations = operationsAndKeyLists.flatMap(
      (result) => result.operations
    )
    const keyLists = operationsAndKeyLists.flatMap((result) => result.keyLists)
    let caseKeyLists: dynamoKeyList = []
    const caseUpdateExpression = 'SET updatedAt = :updatedAt'
    const caseUpdateExpressionAttributeValues = {
      ':updatedAt': now,
    }
    caseIdsSet.forEach(async (caseSubjectIdentifiers, caseId) => {
      const { operations: caseOperations, keyLists: caseKeyListTemp } =
        await createUpdateCaseQueries(this.tenantId, this.tableName, {
          caseId,
          UpdateExpression: caseUpdateExpression,
          ExpressionAttributeValues: caseUpdateExpressionAttributeValues,
          identifiers: caseSubjectIdentifiers,
        })
      operations.push(...caseOperations)
      if (caseKeyListTemp.length > 0) {
        caseKeyLists = concat(caseKeyLists, caseKeyListTemp)
      }
    })
    const dynamoDbConsumerMessage: DynamoConsumerMessage[] =
      generateDynamoConsumerMessage(this.tenantId, [
        { keyLists: keyLists, tableName: this.AlertsClickhouseTableName },
        { keyLists: caseKeyLists, tableName: this.CasesClickhouseTableName },
      ])

    await transactWriteWithClickhouse(
      this.dynamoDb,
      operations,
      dynamoDbConsumerMessage
    )
  }

  /**
   * Get an alert by its ID
   *
   * @param alertId - The ID of the alert to get
   * @returns Promise resolving to the alert or undefined if not found
   */
  public async getAlert(alertId: string): Promise<Alert | undefined> {
    const key = DynamoDbKeys.ALERT(this.tenantId, alertId)
    const command = new GetCommand({
      TableName: StackConstants.TARPON_DYNAMODB_TABLE_NAME(this.tenantId),
      Key: key,
    })

    const commandResult = await this.dynamoDb.send(command)

    return commandResult.Item as Alert | undefined
  }

  /**
   * Updates assignments, qaAssignment and/or review assignments for multiple alerts
   *
   * @param alertIds - Array of alert IDs to update
   * @param assignments - Optional new assignments to set
   * @param reviewAssignments - Optional new review assignments to set
   * @param qaAssignment - Optional new qaAssignment to set
   * @returns Promise that resolves when updates are complete
   */
  public async updateAssignmentsReviewAssignments(
    alertIds: string[],
    assignments?: Assignment[],
    reviewAssignments?: Assignment[],
    qaAssignment?: Assignment[]
  ): Promise<void> {
    const now = Date.now()

    const updateExpressionRecord = {
      updatedAt: now,
    }
    if (assignments) {
      updateExpressionRecord['assignments'] = assignments
    }
    if (reviewAssignments) {
      updateExpressionRecord['reviewAssignments'] = reviewAssignments
    }
    if (qaAssignment) {
      updateExpressionRecord['qaAssignment'] = qaAssignment
    }

    const operationsAndKeyLists = await Promise.all(
      alertIds.map(async (alertId) => {
        return await this.prepareAlertUpdates(alertId, updateExpressionRecord)
      })
    )

    const operations = operationsAndKeyLists.flatMap(
      (result) => result.writeRequests
    )
    const keyLists = operationsAndKeyLists.flatMap((result) => result.keyLists)
    const caseKeyLists = operationsAndKeyLists.flatMap(
      (result) => result.caseKeyLists
    )
    // Create dynamic consumer message for Clickhouse
    const dynamoDbConsumerMessage: DynamoConsumerMessage[] =
      generateDynamoConsumerMessage(this.tenantId, [
        { keyLists: keyLists, tableName: this.AlertsClickhouseTableName },
        { keyLists: caseKeyLists, tableName: this.CasesClickhouseTableName },
      ])
    await transactWriteWithClickhouse(
      this.dynamoDb,
      operations,
      dynamoDbConsumerMessage
    )
  }

  /**
   * Copies review assignments to regular assignments for multiple alerts
   * Used when promoting review assignments after approval
   *
   * @param alertIds - Array of alert IDs to update
   * @returns Promise that resolves when updates are complete
   */
  public async updateReviewAssignmentsToAssignments(
    alertIds: string[]
  ): Promise<void> {
    const now = Date.now()

    const updateExpression = `SET assignments = reviewAssignments, updatedAt = :updatedAt`

    const expressionAttributeValues = {
      ':updatedAt': now,
    }
    const caseUpdateExpression = 'SET updatedAt = :updatedAt'
    const caseUpdateExpressionAttributeValues = {
      ':updatedAt': now,
    }
    const operationsAndKeyLists = await Promise.all(
      alertIds.map(async (alertId) => {
        const alertItem = await this.getAlert(alertId)
        if (!alertItem) {
          return { operations: [], keyLists: [] }
        }
        const { operations: caseOperations, keyLists: caseKeyLists } =
          await createUpdateCaseQueries(this.tenantId, this.tableName, {
            caseId: alertItem.caseId as string,
            UpdateExpression: caseUpdateExpression,
            ExpressionAttributeValues: caseUpdateExpressionAttributeValues,
            identifiers: alertItem.caseSubjectIdentifiers,
          })
        const { operations: alertOperations, keyLists } =
          await this.createAlertUpdatesQueries(
            alertId,
            updateExpression,
            expressionAttributeValues,
            alertItem
          )
        return {
          operations: [...caseOperations, ...alertOperations],
          keyLists,
          caseKeyLists,
        }
      })
    )
    const operations = operationsAndKeyLists.flatMap(
      (result) => result.operations
    )
    const keyLists = operationsAndKeyLists.flatMap((result) => result.keyLists)
    const caseKeyLists = operationsAndKeyLists
      .flatMap((result) => result.caseKeyLists)
      .filter((item) => item !== undefined)
    const dynamoDbConsumerMessage: DynamoConsumerMessage[] =
      generateDynamoConsumerMessage(this.tenantId, [
        { keyLists: keyLists, tableName: this.AlertsClickhouseTableName },
        {
          keyLists: caseKeyLists as dynamoKeyList,
          tableName: this.CasesClickhouseTableName,
        },
      ])
    await transactWriteWithClickhouse(
      this.dynamoDb,
      operations,
      dynamoDbConsumerMessage
    )
  }

  /**
   * Reassign alerts from one user to another, incase of its deletion
   *
   * This method follows the MongoDB implementation's logic:
   * - For alerts with a single assignment matching the assignee, replace that assignment
   * - For alerts with multiple assignments, remove the assignee (don't add new one)
   *
   * @param assignmentId - The ID of the user currently assigned
   * @param reassignmentId - The ID of the user to reassign to
   */
  public async reassignAlerts(
    assignmentId: string,
    reassignmentId: string,
    alertIds: {
      assignments: { single: string[]; multiple: string[] }
      reviewAssignments: { single: string[]; multiple: string[] }
      qaAssignment: { single: string[]; multiple: string[] }
    }
  ): Promise<void> {
    const user = getContext()?.user as Account

    const newAssignment: Assignment[] = [
      {
        assignedByUserId: user.id,
        assigneeUserId: reassignmentId,
        timestamp: Date.now(),
      },
    ]

    const singleAssignmentPromises: Promise<void>[] = []
    const multipleAssignmentPromises: Promise<void>[] = []

    // For alerts with single assignment, replace with new assignment
    if (alertIds.assignments.single.length > 0) {
      for (const alertId of alertIds.assignments.single) {
        singleAssignmentPromises.push(
          this.updateAssignmentsReviewAssignments([alertId], newAssignment)
        )
      }
    }

    // For cases with multiple assignments, remove the assignee
    if (alertIds.assignments.multiple.length > 0) {
      for (const alertId of alertIds.assignments.multiple) {
        const alertItem = await this.getAlert(alertId)
        if (!alertItem || !alertItem.assignments) {
          continue
        }

        const filteredAssignments = alertItem.assignments.filter(
          (a) => a.assigneeUserId !== assignmentId
        )

        multipleAssignmentPromises.push(
          this.updateAssignmentsReviewAssignments(
            [alertId],
            filteredAssignments
          )
        )
      }
    }

    // Process review assignments
    const singleReviewPromises: Promise<void>[] = []
    const multipleReviewPromises: Promise<void>[] = []

    // For cases with single review assignment, replace with new assignment
    if (alertIds.reviewAssignments.single.length > 0) {
      for (const alertId of alertIds.reviewAssignments.single) {
        singleReviewPromises.push(
          this.updateAssignmentsReviewAssignments(
            [alertId],
            undefined,
            newAssignment
          )
        )
      }
    }

    // For cases with multiple review assignments, remove the assignee
    if (alertIds.reviewAssignments.multiple.length > 0) {
      for (const alertId of alertIds.reviewAssignments.multiple) {
        const alertItem = await this.getAlert(alertId)
        if (!alertItem || !alertItem.reviewAssignments) {
          continue
        }

        const filteredAssignments = alertItem.reviewAssignments.filter(
          (a) => a.assigneeUserId !== assignmentId
        )

        multipleReviewPromises.push(
          this.updateAssignmentsReviewAssignments(
            [alertId],
            undefined,
            filteredAssignments
          )
        )
      }
    }

    // Process qaAssignment
    const singleQaAssignmentPromises: Promise<void>[] = []
    const multipleQaAssignmentPromises: Promise<void>[] = []

    // For alerts with single qaAssignment, replace with new assignment
    if (alertIds.qaAssignment.single.length > 0) {
      for (const alertId of alertIds.qaAssignment.single) {
        singleQaAssignmentPromises.push(
          this.updateAssignmentsReviewAssignments(
            [alertId],
            undefined,
            undefined,
            newAssignment
          )
        )
      }
    }

    // For alerts with multiple qaAssignment, remove the assignee
    if (alertIds.qaAssignment.multiple.length > 0) {
      for (const alertId of alertIds.qaAssignment.multiple) {
        const alertItem = await this.getAlert(alertId)
        if (!alertItem || !alertItem.qaAssignment) {
          continue
        }

        const filteredAssignments = alertItem.qaAssignment.filter(
          (a) => a.assigneeUserId !== assignmentId
        )

        multipleQaAssignmentPromises.push(
          this.updateAssignmentsReviewAssignments(
            [alertId],
            undefined,
            undefined,
            filteredAssignments
          )
        )
      }
    }
    // Execute all operations
    await Promise.all([
      ...singleAssignmentPromises,
      ...multipleAssignmentPromises,
      ...singleReviewPromises,
      ...multipleReviewPromises,
      ...singleQaAssignmentPromises,
      ...multipleQaAssignmentPromises,
    ])
  }

  /**
   * Updates the rule queue ID for multiple alerts
   * MIght also set it to null for deletes
   *
   * @param ruleQueueId - The ID of the rule queue
   * @param alertIds - Array of alert IDs to update
   */
  public async updateRuleQueue(ruleQueueId: string | null, alertIds: string[]) {
    const updateExpression = `SET ruleQueueId = :ruleQueueId, updatedAt = :updatedAt`
    const expressionAttributeValues = {
      ':ruleQueueId': ruleQueueId,
      ':updatedAt': Date.now(),
    }
    const caseIdsSet = new Map<string, string[]>()
    const operationsAndKeyLists = await Promise.all(
      alertIds.map(async (alertId) => {
        const alertItem = await this.getAlert(alertId)
        if (!alertItem) {
          return { operations: [], keyLists: [] }
        }
        caseIdsSet.set(
          alertItem.caseId as string,
          alertItem.caseSubjectIdentifiers as string[]
        )
        return await this.createAlertUpdatesQueries(
          alertId,
          updateExpression,
          expressionAttributeValues,
          alertItem
        )
      })
    )
    const operations = operationsAndKeyLists.flatMap(
      (result) => result.operations
    )
    const keyLists = operationsAndKeyLists.flatMap((result) => result.keyLists)
    const dynamoDbConsumerMessage: DynamoConsumerMessage[] =
      generateDynamoConsumerMessage(this.tenantId, [
        { keyLists: keyLists, tableName: this.AlertsClickhouseTableName },
      ])
    // I am getting all the distinct caseIds and caseSubjectIdentifiers in a set to avoid duplicate update on dynamo and clickhouse
    const caseUpdateExpression = 'SET updatedAt = :updatedAt'
    const caseUpdateExpressionAttributeValues = {
      ':updatedAt': Date.now(),
    }
    caseIdsSet.forEach(async (caseSubjectIdentifiers, caseId) => {
      const { operations: caseOperations, keyLists: caseKeyLists } =
        await createUpdateCaseQueries(this.tenantId, this.tableName, {
          caseId,
          UpdateExpression: caseUpdateExpression,
          ExpressionAttributeValues: caseUpdateExpressionAttributeValues,
          identifiers: caseSubjectIdentifiers,
        })
      operations.push(...caseOperations)
      if (caseKeyLists.length > 0) {
        dynamoDbConsumerMessage.push({
          tenantId: this.tenantId,
          tableName: this.CasesClickhouseTableName,
          items: caseKeyLists,
        })
      }
    })
    await transactWriteWithClickhouse(
      this.dynamoDb,
      operations,
      dynamoDbConsumerMessage
    )
  }

  public async getAlertsFromAlertIds(
    alertIds: string[],
    { getComments = false }: { getComments?: boolean } = {}
  ): Promise<Alert[]> {
    let alerts = await batchGet<Alert>(
      this.dynamoDb,
      StackConstants.TARPON_DYNAMODB_TABLE_NAME(this.tenantId),
      alertIds.map((alertId) => DynamoDbKeys.ALERT(this.tenantId, alertId))
    )

    if (getComments) {
      const comments = await this.getComments(alertIds)
      const files = await this.getFiles(alertIds)
      const sanctionsDetails = await this.getSanctionsDetails(alertIds)
      const transactionIds = await this.getAlertTransactionIdsForAlerts(
        alertIds
      )
      alerts = alerts.map((alertItem) => {
        const enrichedComments = comments
          .filter((comment) => comment.alertId === alertItem.alertId)
          .map((comment) => ({
            ...comment,
            files: files.filter(
              (file) =>
                file.alertId === alertItem.alertId &&
                file.commentId === comment.id
            ),
          }))

        return {
          ...alertItem,
          ruleHitMeta: {
            ...alertItem.ruleHitMeta,
            sanctionsDetails:
              sanctionsDetails.get(alertItem.alertId as string) || [],
          },
          transactionIds: transactionIds[alertItem.alertId as string] || [],
          comments: enrichedComments,
        }
      })
    }

    const alertMap = alerts.reduce((acc, item) => {
      const alertId = item.alertId as string
      acc[alertId] = omit(item, ['PartitionKeyID', 'SortKeyID']) as Alert
      return acc
    }, {} as Record<string, Alert>)

    return alertIds.map((id) => alertMap[id]).filter(Boolean)
  }

  async getAlertTransactionIds(alertId: string): Promise<string[]> {
    const key = DynamoDbKeys.ALERT_TRANSACTION_IDS(this.tenantId, alertId)
    const commandInput: GetCommandInput = {
      TableName: this.tableName,
      Key: key,
    }
    const command = new GetCommand(commandInput)

    const result = await this.dynamoDb.send(command)

    const transactionIds = (result.Item?.transactionIds as string[]) || []

    return [...new Set(transactionIds)]
  }

  public async getAlertTransactionIdsForAlerts(
    alertIds: string[]
  ): Promise<Record<string, string[]>> {
    const queryPromises = alertIds.map((alertId) => {
      const key = DynamoDbKeys.ALERT_TRANSACTION_IDS(this.tenantId, alertId)
      const queryInput: QueryCommandInput = {
        TableName: this.tableName,
        KeyConditionExpression: 'PartitionKeyID = :pk AND SortKeyID = :sk',
        ExpressionAttributeValues: {
          ':pk': key.PartitionKeyID,
          ':sk': key.SortKeyID,
        },
      }
      return paginateQuery(this.dynamoDb, queryInput)
    })
    const results = await Promise.all(queryPromises)

    const transactionIds: Record<string, string[]> = {}

    results.forEach((result, index) => {
      const alertId = alertIds[index]
      if (result.Items) {
        transactionIds[alertId] = result.Items.map(
          (item) => item.transactionIds
        ).flat()
      } else {
        transactionIds[alertId] = []
      }
    })

    return transactionIds
  }

  public async getAlertsByCaseIds(
    caseIds: string[],
    {
      getComments = false,
      getTransactionIds = false,
      getSanctionsDetails = false,
    }: {
      getComments?: boolean
      getTransactionIds?: boolean
      getSanctionsDetails?: boolean
    } = {}
  ): Promise<Alert[]> {
    const queryPromises = caseIds.map((caseId) => {
      const partitionKey = DynamoDbKeys.CASE_ALERT(
        this.tenantId,
        caseId
      ).PartitionKeyID

      const queryInput: QueryCommandInput = {
        TableName: StackConstants.TARPON_DYNAMODB_TABLE_NAME(this.tenantId),
        KeyConditionExpression: 'PartitionKeyID = :pk',
        ExpressionAttributeValues: {
          ':pk': partitionKey,
        },
      }

      return paginateQuery(this.dynamoDb, queryInput)
    })

    // Execute all queries in parallel
    const results = await Promise.all(queryPromises)

    // Combine all results
    let alerts: Alert[] = []
    results.forEach((result) => {
      if (result.Items) {
        alerts.push(...(result.Items as Alert[]))
      }
    })
    const alertIds = alerts
      .map((item) => item.alertId && (item.alertId as string))
      .filter(Boolean) as string[]
    let comments: AlertCommentsInternal[] = []
    let files: AlertCommentFileInternal[] = []
    if (getComments) {
      comments = await this.getComments(alertIds)
      files = await this.getFiles(alertIds)
    }
    if (getSanctionsDetails) {
      const sanctionsDetails: Map<string, SanctionsDetailsInternal[]> =
        await this.getSanctionsDetails(alertIds)
      alerts = alerts.map((item) => ({
        ...item,
        ruleHitMeta: {
          ...item.ruleHitMeta,
          sanctionsDetails: sanctionsDetails.get(item.alertId as string) || [],
        },
      }))
    }
    if (getTransactionIds) {
      const transactionIds = await this.getAlertTransactionIdsForAlerts(
        alertIds
      )
      alerts = alerts.map((item) => ({
        ...item,
        transactionIds: transactionIds[item.alertId as string] || [],
      }))
    }

    // Create maps for efficient lookup
    const commentsByAlertId = new Map<string, AlertCommentsInternal[]>()
    const filesByAlertAndComment = new Map<string, AlertCommentFileInternal[]>()

    // Group comments by alertId
    comments.forEach((comment) => {
      const alertId = comment.alertId
      if (!alertId) {
        return
      }
      if (!commentsByAlertId.has(alertId)) {
        commentsByAlertId.set(alertId, [])
      }
      commentsByAlertId.get(alertId)?.push(comment)
    })

    // Group files by alertId + commentId combination
    files.forEach((file) => {
      if (file.alertId && file.commentId) {
        const key = `${file.alertId}:${file.commentId}`
        if (!filesByAlertAndComment.has(key)) {
          filesByAlertAndComment.set(key, [])
        }
        const existingFiles = filesByAlertAndComment.get(key)
        if (existingFiles) {
          existingFiles.push(file)
        }
      }
    })

    return alerts.map((item) => {
      const alertComments = commentsByAlertId.get(item.alertId as string) || []
      const enrichedComments = alertComments.map((comment) => ({
        ...comment,
        files:
          item.alertId && comment.id
            ? filesByAlertAndComment.get(`${item.alertId}:${comment.id}`) || []
            : [],
      }))

      item = omit(item, ['PartitionKeyID', 'SortKeyID']) as Alert
      return { ...item, comments: enrichedComments }
    })
  }

  public async updateAlertInDynamo(
    caseId: string,
    alertId: string,
    data: Partial<Alert>,
    caseData: { caseAggregates?: CaseAggregates; caseTransactionIds?: string[] }
  ): Promise<CaseWithoutCaseTransactions | undefined | void> {
    const now = Date.now()

    const updateExpressionRecord = {
      ...data,
      updatedAt: now,
    }

    const alertItem = await this.getAlert(alertId)
    if (!alertItem) {
      throw new Error(`Alert with ID ${alertId} not found`)
    }

    const { writeRequests, keyLists } = await this.prepareAlertUpdates(
      alertId,
      updateExpressionRecord,
      alertItem,
      { updateCase: false, caseUpdateFields: {} }
    )
    const caseUpdateFields = {
      updatedAt: now,
    }

    if (caseData.caseAggregates) {
      caseUpdateFields['caseAggregates'] = caseData.caseAggregates
    }

    if (caseData.caseTransactionIds) {
      caseUpdateFields['caseTransactionsIds'] = caseData.caseTransactionIds
      caseUpdateFields['caseTransactionsCount'] =
        caseData.caseTransactionIds.length
    }
    const caseUpdateExpression =
      getUpdateAttributesUpdateItemInput(caseUpdateFields)

    const { operations: caseOperations, keyLists: caseKeyLists } =
      await createUpdateCaseQueries(this.tenantId, this.tableName, {
        caseId,
        UpdateExpression: caseUpdateExpression.UpdateExpression,
        ExpressionAttributeValues:
          caseUpdateExpression.ExpressionAttributeValues,
        identifiers: alertItem.caseSubjectIdentifiers,
      })

    const operations = [...writeRequests, ...caseOperations]
    const dynamoDbConsumerMessage: DynamoConsumerMessage[] =
      generateDynamoConsumerMessage(this.tenantId, [
        { keyLists: keyLists, tableName: this.AlertsClickhouseTableName },
        { keyLists: caseKeyLists, tableName: this.CasesClickhouseTableName },
      ])

    await transactWriteWithClickhouse(
      this.dynamoDb,
      operations,
      dynamoDbConsumerMessage
    )

    // Pausing the return as it will be returned from mongo for now
    // return this.getCaseById(caseId)
  }

  /**
   * Marks all checklist items as DONE for multiple alerts
   *
   * @param alertIds - Array of alert IDs to update
   * @returns Promise that resolves when the update is complete
   */
  public async markUnMarkedChecklistItemsDone(
    alertIds: string[]
  ): Promise<void> {
    const now = Date.now()
    const operations: TransactWriteOperation[] = []
    const alertKeyLists: dynamoKeyList = []
    const caseKeyLists: dynamoKeyList = []
    const caseIdsSet = new Map<string, string[]>()

    const alerts = await this.getAlertsFromAlertIds(alertIds)

    for (const alert of alerts) {
      const alertId = alert.alertId as string

      if (
        !alert.ruleChecklist ||
        alert.ruleChecklist === null ||
        alert.ruleChecklist.length === 0
      ) {
        continue
      }

      if (alert.caseId && alert.caseSubjectIdentifiers) {
        caseIdsSet.set(alert.caseId, alert.caseSubjectIdentifiers as string[])
      }

      const hasItemsToUpdate = alert.ruleChecklist.some(
        (item) => item.done === 'NOT_STARTED'
      )

      if (!hasItemsToUpdate) {
        continue
      }

      const updatedChecklist = alert.ruleChecklist.map((item) => ({
        ...item,
        ...(item.done === 'NOT_STARTED' ? { done: 'DONE' } : {}),
      }))

      const { operations: alertOperations, keyLists } =
        await this.createAlertUpdatesQueries(
          alertId,
          'SET ruleChecklist = :checklist, updatedAt = :updatedAt',
          {
            ':checklist': updatedChecklist,
            ':updatedAt': now,
          },
          alert
        )

      operations.push(...alertOperations)
      alertKeyLists.push(...keyLists)
    }

    for (const [caseId, subjectIdentifiers] of caseIdsSet.entries()) {
      const { operations: caseOperations, keyLists: caseLists } =
        await createUpdateCaseQueries(this.tenantId, this.tableName, {
          caseId,
          UpdateExpression: 'SET updatedAt = :updatedAt',
          ExpressionAttributeValues: { ':updatedAt': now },
          identifiers: subjectIdentifiers,
        })

      operations.push(...caseOperations)
      caseKeyLists.push(...caseLists)
    }

    if (operations.length === 0) {
      return
    }

    const dynamoDbConsumerMessages: DynamoConsumerMessage[] =
      generateDynamoConsumerMessage(this.tenantId, [
        { keyLists: alertKeyLists, tableName: this.AlertsClickhouseTableName },
        { keyLists: caseKeyLists, tableName: this.CasesClickhouseTableName },
      ])

    await transactWriteWithClickhouse(
      this.dynamoDb,
      operations,
      dynamoDbConsumerMessages
    )
  }
  public async getComments(
    alertIds: string[]
  ): Promise<AlertCommentsInternal[]> {
    const queryPromises = alertIds.map((alertId) => {
      const partitionKey = DynamoDbKeys.ALERT_COMMENT(
        this.tenantId,
        alertId,
        ''
      ).PartitionKeyID
      const queryInput: QueryCommandInput = {
        TableName: this.tableName,
        KeyConditionExpression: 'PartitionKeyID = :pk',
        ExpressionAttributeValues: {
          ':pk': partitionKey,
        },
      }

      return paginateQuery(this.dynamoDb, queryInput)
    })

    const results = await Promise.all(queryPromises)

    const comments: AlertCommentsInternal[] = []
    results.forEach((result) => {
      if (result.Items) {
        comments.push(...(result.Items as AlertCommentsInternal[]))
      }
    })

    return comments.map((item) => {
      item = omit(item, [
        'PartitionKeyID',
        'SortKeyID',
      ]) as AlertCommentsInternal
      return item
    })
  }
  public async getFiles(
    alertIds: string[],
    commentId?: string
  ): Promise<AlertCommentFileInternal[]> {
    const queryPromises = alertIds.map((alertId) => {
      const partitionKey = DynamoDbKeys.ALERT_COMMENT_FILE(
        this.tenantId,
        alertId,
        commentId
      ).PartitionKeyID

      const queryInput: QueryCommandInput & {
        ExpressionAttributeValues: Record<string, any>
      } = {
        TableName: this.tableName,
        KeyConditionExpression: 'PartitionKeyID = :pk',
        ExpressionAttributeValues: {
          ':pk': partitionKey,
        },
      }

      if (commentId) {
        queryInput.KeyConditionExpression +=
          ' AND begins_with(SortKeyID, :skPrefix)'
        queryInput.ExpressionAttributeValues[':skPrefix'] = `${commentId}#`
      }

      return paginateQuery(this.dynamoDb, queryInput)
    })

    const results = await Promise.all(queryPromises)

    const files: AlertCommentFileInternal[] = []
    results.forEach((result) => {
      if (result.Items) {
        files.push(...(result.Items as AlertCommentFileInternal[]))
      }
    })

    return files.map((item) => {
      item = omit(item, [
        'PartitionKeyID',
        'SortKeyID',
      ]) as AlertCommentFileInternal
      return item
    })
  }

  public async getSanctionsDetails(
    alertIds: string[]
  ): Promise<Map<string, SanctionsDetailsInternal[]>> {
    const alertsSanctionsDetails = new Map<string, SanctionsDetailsInternal[]>()
    const queryPromises = alertIds.map((alertId) => {
      const partitionKey = DynamoDbKeys.ALERT_SANCTIONS_DETAILS(
        this.tenantId,
        alertId,
        ''
      ).PartitionKeyID
      const queryInput: QueryCommandInput = {
        TableName: this.tableName,
        KeyConditionExpression: 'PartitionKeyID = :pk',
        ExpressionAttributeValues: {
          ':pk': partitionKey,
        },
      }

      return paginateQuery(this.dynamoDb, queryInput)
    })

    const results = await Promise.all(queryPromises)

    results.forEach((result) => {
      if (result.Items) {
        const items = result.Items as SanctionsDetailsInternal[]
        items.forEach((item) => {
          if (!alertsSanctionsDetails.has(item.alertId)) {
            alertsSanctionsDetails.set(item.alertId, [])
          }
          item = omit(item, [
            'PartitionKeyID',
            'SortKeyID',
          ]) as SanctionsDetailsInternal
          alertsSanctionsDetails.get(item.alertId)?.push(item)
        })
      }
    })

    return alertsSanctionsDetails
  }

  public async getAlertIdsByCaseIds(caseIds: string[]): Promise<string[]> {
    const alertIds: string[] = []

    await Promise.all(
      caseIds.map(async (caseId) => {
        const queryInput: QueryCommandInput = {
          TableName: StackConstants.TARPON_DYNAMODB_TABLE_NAME(this.tenantId),
          KeyConditionExpression: 'PartitionKeyID = :pk',
          ExpressionAttributeValues: {
            ':pk': DynamoDbKeys.CASE_ALERT(this.tenantId, caseId)
              .PartitionKeyID,
          },
        }
        const result = await paginateQuery(this.dynamoDb, queryInput)
        if (result.Items) {
          const caseAlertIds = result.Items.map(
            (item) => item.alertId as string
          ).filter(Boolean)
          alertIds.push(...caseAlertIds)
        }
      })
    )

    return alertIds
  }

  public async deleteAlertsData(tenantId: string) {
    const partitionKeyId = DynamoDbKeys.ALERT(tenantId, '').PartitionKeyID
    const queryInput: QueryCommandInput = {
      TableName: StackConstants.TARPON_DYNAMODB_TABLE_NAME(tenantId),
      KeyConditionExpression: 'PartitionKeyID = :pk',
      ExpressionAttributeValues: {
        ':pk': partitionKeyId,
      },
    }

    await dangerouslyQueryPaginateDelete<Alert>(
      this.dynamoDb,
      tenantId,
      queryInput,
      (tenantId, alert) => {
        return this.deleteAlert(tenantId, alert)
      }
    )
  }

  private async deleteAlert(tenantId: string, alert: Alert) {
    const alertId = alert.alertId as string

    await Promise.all([
      dangerouslyDeletePartition(
        this.dynamoDb,
        tenantId,
        DynamoDbKeys.ALERT_COMMENT(tenantId, alertId, '').PartitionKeyID,
        StackConstants.TARPON_DYNAMODB_TABLE_NAME(tenantId),
        'Alert Comment'
      ),
      dangerouslyDeletePartition(
        this.dynamoDb,
        tenantId,
        DynamoDbKeys.ALERT_COMMENT_FILE(tenantId, alertId, '', '')
          .PartitionKeyID,
        StackConstants.TARPON_DYNAMODB_TABLE_NAME(tenantId),
        'Alert Comment File'
      ),
      dangerouslyDeletePartitionKey(
        this.dynamoDb,
        DynamoDbKeys.ALERT(tenantId, alertId),
        StackConstants.TARPON_DYNAMODB_TABLE_NAME(tenantId)
      ),
      dangerouslyDeletePartitionKey(
        this.dynamoDb,
        DynamoDbKeys.ALERT_SANCTIONS_DETAILS(tenantId, alertId, ''),
        StackConstants.TARPON_DYNAMODB_TABLE_NAME(tenantId)
      ),
      dangerouslyDeletePartitionKey(
        this.dynamoDb,
        DynamoDbKeys.ALERT_TRANSACTION_IDS(tenantId, alertId),
        StackConstants.TARPON_DYNAMODB_TABLE_NAME(tenantId)
      ),
    ])
  }

  /**
   * Update the QA count in the sampling table
   *
   * @param alert - The alert to update
   * @param qaStatus - The QA status to update
   */
  public async updateAlertQACountInSampling(
    alert: Alert,
    qaStatus?: ChecklistStatus
  ) {
    const partitionKey = DynamoDbKeys.ALERTS_QA_SAMPLING(
      this.tenantId,
      ''
    ).PartitionKeyID

    const queryInput: QueryCommandInput = {
      TableName: this.tableName,
      KeyConditionExpression: 'PartitionKeyID = :pk',
      FilterExpression: 'contains(alertIds, :alertId)',
      ExpressionAttributeValues: {
        ':pk': partitionKey,
        ':alertId': alert.alertId,
      },
    }

    const result = await paginateQuery(this.dynamoDb, queryInput)

    if (!result.Items?.length) {
      return
    }

    const increment =
      alert.ruleQaStatus && !qaStatus
        ? -1
        : !alert.ruleQaStatus && qaStatus
        ? 1
        : 0

    if (increment === 0) {
      return
    }

    const keyLists: dynamoKeyList = []

    // Create document client and batch for operations

    const batch = new DynamoTransactionBatch(this.dynamoDb, this.tableName)

    for (const item of result.Items) {
      const key = DynamoDbKeys.ALERTS_QA_SAMPLING(
        this.tenantId,
        item.samplingId
      )

      batch.update({
        Key: key,
        UpdateExpression:
          'SET numberOfAlertsQaDone = numberOfAlertsQaDone + :inc',
        ExpressionAttributeValues: {
          ':inc': increment,
        },
      })

      keyLists.push({ key })
    }
    await batch.execute()
    if (envIs('local') || envIs('test')) {
      for (const key of keyLists) {
        const { handleLocalTarponChangeCapture } = await import(
          '@/core/local-handlers/tarpon'
        )

        await handleLocalTarponChangeCapture(this.tenantId, [key.key])
      }
    }
  }

  private QASampleKeys(samplingId: string) {
    return DynamoDbKeys.ALERTS_QA_SAMPLING(this.tenantId, samplingId)
  }

  public async saveDemoQASampleData(data: AlertsQaSampling[]) {
    const writeRequests: BatchWriteRequestInternal[] = []
    for (const item of data) {
      if (!item.samplingId) {
        logger.warn('Demo alerts Qa sampling data: Sampling ID is required')
        continue
      }
      const alert = omit(sanitizeMongoObject(item), ['_id'])
      const key = this.QASampleKeys(item.samplingId)
      writeRequests.push({
        PutRequest: {
          Item: {
            ...key,
            ...alert,
          },
        },
      })
    }
    return { writeRequests, tableName: this.tableName }
  }

  /**
   * Save QA sample data to DynamoDB
   *
   * @param data - The QA sample data to save
   */
  public async saveQASampleData(data: AlertsQaSampling) {
    const alert = omit(sanitizeMongoObject(data), ['_id'])
    if (alert.samplingId) {
      const key = this.QASampleKeys(alert.samplingId)

      // Create document client from raw client for batch operations

      const batch = new DynamoTransactionBatch(this.dynamoDb, this.tableName)

      batch.put({
        Item: {
          ...key,
          ...alert,
        },
      })

      await batch.execute()

      if (envIs('local') || envIs('test')) {
        const { handleLocalTarponChangeCapture } = await import(
          '@/core/local-handlers/tarpon'
        )

        await handleLocalTarponChangeCapture(this.tenantId, [key])
      }
    } else {
      logger.warn('Sampling ID is required')
    }
  }

  /**
   * Get QA sample data by sampling ID
   *
   * @param samplingId - The sampling ID to get data for
   * @returns The QA sample data
   */
  public async getSamplingDataById(samplingId: string) {
    const key = DynamoDbKeys.ALERTS_QA_SAMPLING(this.tenantId, samplingId)
    const command = new GetCommand({
      TableName: StackConstants.TARPON_DYNAMODB_TABLE_NAME(this.tenantId),
      Key: key,
    })

    const commandResult = await this.dynamoDb.send(command)

    return commandResult.Item as AlertsQaSampling | undefined
  }

  /**
   * Update QA sample data
   *
   * @param data - The QA sample data to update
   */
  public async updateQASampleData(data: AlertsQaSampling) {
    const now = Date.now()
    const cleanData = omit(sanitizeMongoObject(data), ['_id', 'id'])

    const updateExpressionRecord = {
      ...cleanData,
      updatedAt: now,
    }

    const alertQaSampling = await this.getSamplingDataById(data.samplingId)
    if (!alertQaSampling) {
      throw new Error(`Alert QASampling with ID ${data.samplingId} not found`)
    }

    const { UpdateExpression, ExpressionAttributeValues } =
      getUpdateAttributesUpdateItemInput(updateExpressionRecord)

    const key = DynamoDbKeys.ALERTS_QA_SAMPLING(this.tenantId, data.samplingId)
    const writeRequests: TransactWriteOperation[] = [
      {
        Update: {
          TableName: this.tableName,
          Key: key,
          UpdateExpression,
          ExpressionAttributeValues,
        },
      },
    ]

    const dynamoDbConsumerMessage: DynamoConsumerMessage[] =
      generateDynamoConsumerMessage(this.tenantId, [
        {
          keyLists: [{ key }],
          tableName: this.AlertsQaSamplingTableName,
        },
      ])

    await transactWriteWithClickhouse(
      this.dynamoDb,
      writeRequests,
      dynamoDbConsumerMessage
    )
  }

  /**
   * Get all sampling IDs
   *
   * @returns An array of sampling IDs and names
   */
  public async getSamplingIds(): Promise<
    { samplingId: string; samplingName: string }[]
  > {
    const partitionKey = DynamoDbKeys.ALERTS_QA_SAMPLING(
      this.tenantId,
      ''
    ).PartitionKeyID

    const queryInput: QueryCommandInput = {
      TableName: this.tableName,
      KeyConditionExpression: 'PartitionKeyID = :pk',
      ExpressionAttributeValues: {
        ':pk': partitionKey,
      },
      ProjectionExpression: 'samplingId, samplingName',
    }

    const result = await paginateQuery(this.dynamoDb, queryInput)

    return compact(
      (result.Items || []).map((item) => ({
        samplingId: item.samplingId,
        samplingName: item.samplingName,
      }))
    )
  }

  /**
   * Delete QA sample data
   *
   * @param sampleId - The sampling ID to delete
   */
  public async deleteSample(sampleId: string): Promise<void> {
    const key = DynamoDbKeys.ALERTS_QA_SAMPLING(this.tenantId, sampleId)
    await dangerouslyDeletePartitionKey(this.dynamoDb, key, this.tableName)
    const query = `ALTER TABLE ${this.AlertsQaSamplingTableName} UPDATE is_deleted = 1 WHERE samplingId = '${sampleId}'`
    const client = await getClickhouseClient(this.tenantId)
    await client.query({ query })
  }

  public async getAlertsQASamplingFromIds(
    ids: string[]
  ): Promise<AlertsQaSampling[]> {
    const alerts = await batchGet<AlertsQaSampling>(
      this.dynamoDb,
      StackConstants.TARPON_DYNAMODB_TABLE_NAME(this.tenantId),
      ids.map((id) => DynamoDbKeys.ALERTS_QA_SAMPLING(this.tenantId, id))
    )

    const alertMap = alerts.reduce((acc, item) => {
      const alertId = item.samplingId as string
      acc[alertId] = omit(item, [
        'PartitionKeyID',
        'SortKeyID',
      ]) as AlertsQaSampling
      return acc
    }, {} as Record<string, AlertsQaSampling>)

    return ids.map((id) => alertMap[id]).filter(Boolean)
  }
}
