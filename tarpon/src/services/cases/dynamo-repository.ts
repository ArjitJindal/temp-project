import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import {
  GetCommand,
  GetCommandInput,
  NativeAttributeValue,
  QueryCommandInput,
} from '@aws-sdk/lib-dynamodb'
import { StackConstants } from '@lib/constants'
import { concat, omit } from 'lodash'
import { v4 as uuidv4 } from 'uuid'
import { DynamoAlertRepository } from '../alerts/dynamo-repository'
import {
  createUpdateCaseQueries,
  dynamoKeyList,
  generateDynamoConsumerMessage,
  getCaseAuxiliaryIndexes,
  transactWriteWithClickhouse,
} from '../case-alerts-common/utils'
import { SlaUpdates } from '../sla/sla-service'
import { Assignment } from '@/@types/openapi-internal/Assignment'
import { CaseStatusChange } from '@/@types/openapi-internal/CaseStatusChange'
import { DynamoDbKeys } from '@/core/dynamodb/dynamodb-keys'
import {
  batchGet,
  sanitizeMongoObject,
  TransactWriteOperation,
  paginateQuery,
  getUpdateAttributesUpdateItemInput,
  dangerouslyDeletePartition,
  dangerouslyDeletePartitionKey,
  dangerouslyQueryPaginateDelete,
} from '@/utils/dynamodb'
import { Case } from '@/@types/openapi-internal/Case'
import { Comment } from '@/@types/openapi-internal/Comment'
import { FileInfo } from '@/@types/openapi-internal/FileInfo'
import { DynamoConsumerMessage } from '@/lambdas/dynamo-db-trigger-consumer'
import { CLICKHOUSE_DEFINITIONS } from '@/utils/clickhouse/definition'
import { CaseStatus } from '@/@types/openapi-internal/CaseStatus'
import { CaseType } from '@/@types/openapi-internal/CaseType'
import { getPaymentDetailsIdentifiersSubject } from '@/services/logic-evaluator/variables/payment-details'
import { InternalUser } from '@/@types/openapi-internal/InternalUser'
import { logger } from '@/core/logger'
import { InternalTransaction } from '@/@types/openapi-internal/InternalTransaction'
import { getContext } from '@/core/utils/context-storage'
import { Account } from '@/@types/openapi-internal/Account'
import { traceable } from '@/core/xray'
import {
  CaseCommentFileInternal,
  CaseCommentsInternal,
} from '@/@types/cases/CasesInternal'
import { CaseSubject } from '@/services/case-alerts-common/utils'

type CaseWithoutCaseTransactions = Omit<Case, 'caseTransactions'>

type SubjectCasesQueryParams = {
  directions?: ('ORIGIN' | 'DESTINATION')[]
  filterMaxTransactions?: number
  filterOutCaseStatus?: CaseStatus
  filterTransactionId?: string
  filterAvailableAfterTimestamp?: (number | undefined)[]
  filterCaseType?: CaseType
}
// Note: Do not export this variables as they are not used outside this file
const CASES_TABLE_NAME_CH = CLICKHOUSE_DEFINITIONS.CASES_V2.tableName

@traceable
export class DynamoCaseRepository {
  private readonly tenantId: string
  private readonly dynamoDb: DynamoDBClient
  private readonly dynamoAlertRepository: DynamoAlertRepository
  private readonly tableName: string

  /**
   * Initializes a new DynamoCaseRepository instance
   *
   * @param tenantId - The tenant ID for multi-tenancy support
   * @param dynamoDb - Initialized DynamoDB client to use for all operations
   */
  constructor(tenantId: string, dynamoDb: DynamoDBClient) {
    this.tenantId = tenantId
    this.dynamoDb = dynamoDb
    this.dynamoAlertRepository = new DynamoAlertRepository(tenantId, dynamoDb)
    this.tableName = StackConstants.TARPON_DYNAMODB_TABLE_NAME(this.tenantId)
  }

  /**
   * Adds a single case to DynamoDB
   *
   * @param caseEntity - The case to be added
   * @returns Promise resolving to the added case without caseTransactions
   */
  async addCase(caseEntity: Case): Promise<CaseWithoutCaseTransactions> {
    // TODO: Add a counter repository
    await this.saveCases([caseEntity])
    logger.debug(`Added case ${caseEntity.caseId} to DynamoDB`)
    return caseEntity
  }

  /**
   * Saves multiple case records and their associated data to DynamoDB
   *
   * This method handles:
   * - Persisting main case entities
   * - Saving associated comments for each case
   * - Saving associated alerts for each case
   * - Optionally sending case data to Clickhouse for analytics
   *
   * The function performs all operations in batches where possible to optimize
   * database interactions.
   *
   * @param cases - Array of Case objects to be saved
   * @param saveToClickhouse - Whether to sync the case data to Clickhouse (defaults to true)
   * @returns Promise that resolves when all save operations complete
   */
  public async saveCases(
    cases: Case[],
    saveToClickhouse: boolean = true
  ): Promise<void> {
    let writeRequests: TransactWriteOperation[] = []
    const keyLists: dynamoKeyList = []
    let alertsWriteRequests: {
      batchWriteRequests: TransactWriteOperation[]
      message?: DynamoConsumerMessage
    } = { batchWriteRequests: [] }

    for (const caseItem of cases) {
      const caseId = caseItem.caseId as string
      const key = DynamoDbKeys.CASE(this.tenantId, caseId)
      keyLists.push({
        key,
      })

      let caseToSave = { ...caseItem }
      // Generate and add auxiliary indexes for the case
      const { auxiliaryIndexes, identifiers } = getCaseAuxiliaryIndexes(
        this.tenantId,
        caseToSave
      )

      const comments = caseToSave.comments || []
      const alerts = caseToSave.alerts || []
      const caseTransactionIds = caseToSave.caseTransactionsIds || []
      const alertsToSave = alerts.map((alert) => ({
        ...alert,
        caseCreatedTimestamp: caseItem.createdTimestamp,
        caseSubjectIdentifiers: identifiers,
      }))

      caseToSave = omit(caseToSave, [
        'comments',
        'alerts',
        'caseTransactionsIds',
      ])

      const caseToSaveWithId = sanitizeMongoObject(caseToSave)
      // Add primary case record with table name
      caseToSaveWithId.caseSubjectIdentifiers = identifiers

      writeRequests.push({
        Put: {
          TableName: this.tableName,
          Item: {
            ...key,
            ...caseToSaveWithId,
          },
        },
      })

      writeRequests = concat(
        writeRequests,
        auxiliaryIndexes.map((item) => ({
          Put: {
            TableName: this.tableName,
            Item: {
              ...item,
              ...caseToSaveWithId,
            },
          },
        }))
      )

      // Add case comments if they exist
      writeRequests = concat(
        writeRequests,
        await this.saveComments(caseId, comments, false)
      )

      // Add case transaction ids if they exist
      writeRequests = concat(
        writeRequests,
        await this.saveCaseTransactionIds(caseId, caseTransactionIds)
      )

      // Add case alerts if they exist
      alertsWriteRequests = await this.dynamoAlertRepository.saveAlertsForCase(
        alertsToSave,
        caseId,
        false
      )
      writeRequests = concat(
        writeRequests,
        alertsWriteRequests.batchWriteRequests
      )
    }
    let dynamoDbConsumerMessage: DynamoConsumerMessage[] = []
    if (saveToClickhouse) {
      dynamoDbConsumerMessage = generateDynamoConsumerMessage(this.tenantId, [
        { keyLists: keyLists, tableName: CASES_TABLE_NAME_CH },
      ])
      if (alertsWriteRequests.message) {
        dynamoDbConsumerMessage.push(alertsWriteRequests.message)
      }
    }
    await transactWriteWithClickhouse(
      this.dynamoDb,
      writeRequests,
      dynamoDbConsumerMessage
    )
  }

  /**
   * Saves comments associated with a case to DynamoDB
   *
   * @param caseId - The ID of the case the comments belong to
   * @param comments - Array of comments to save
   * @param updateHere - Whether to execute the write operations immediately
   * @returns Promise resolving to write operations (if updateHere is false) or empty array
   */
  public async saveComments(
    caseId: string,
    comments: Comment[],
    updateHere: boolean = true
  ): Promise<TransactWriteOperation[]> {
    if (!comments || comments.length === 0) {
      return []
    }

    let writeRequests: TransactWriteOperation[] = []
    let keyLists: dynamoKeyList = []

    if (updateHere) {
      const { writeRequests: caseWriteRequests, keyLists: caseKeyLists } =
        await this.prepareCaseUpdates(caseId)
      writeRequests = concat(writeRequests, caseWriteRequests)
      keyLists = concat(keyLists, caseKeyLists)
    }

    // Add all comments
    for (const comment of comments) {
      const commentKey = DynamoDbKeys.CASE_COMMENT(
        this.tenantId,
        caseId,
        comment.id as string
      )

      let commentToSave: CaseCommentsInternal = { ...comment, caseId }
      const files = commentToSave.files || []
      commentToSave = omit(commentToSave, ['files'])

      writeRequests.push({
        Put: {
          TableName: this.tableName,
          Item: {
            ...commentKey,
            ...commentToSave,
          },
        },
      })

      // Add comment files if they exist
      writeRequests = concat(
        writeRequests,
        await this.saveCommentsFiles(caseId, comment.id as string, files, false)
      )
    }
    if (updateHere) {
      const dynamoDbConsumerMessage = generateDynamoConsumerMessage(
        this.tenantId,
        [{ keyLists: keyLists, tableName: CASES_TABLE_NAME_CH }]
      )
      await transactWriteWithClickhouse(
        this.dynamoDb,
        writeRequests,
        dynamoDbConsumerMessage
      )
      return []
    }
    return writeRequests
  }

  /**
   * Saves files associated with a comment to DynamoDB
   *
   * @param caseId - The ID of the case the files belong to
   * @param commentId - The ID of the comment the files belong to
   * @param files - Array of file info objects to save
   * @param updateHere - Whether to execute the write operations immediately
   * @returns Promise resolving to write operations (if updateHere is false) or empty array
   */
  public async saveCommentsFiles(
    caseId: string,
    commentId: string,
    files: FileInfo[],
    updateHere: boolean = true
  ): Promise<TransactWriteOperation[]> {
    if (!files || files.length === 0) {
      return []
    }

    let writeRequests: TransactWriteOperation[] = []
    let keyLists: dynamoKeyList = []
    const now = Date.now()

    if (updateHere) {
      const { writeRequests: caseWriteRequests, keyLists: caseKeyLists } =
        await this.prepareCaseUpdates(caseId)
      writeRequests = concat(writeRequests, caseWriteRequests)
      keyLists = concat(keyLists, caseKeyLists)

      // Update the comment updatedAt timestamp
      const commentKey = DynamoDbKeys.CASE_COMMENT(
        this.tenantId,
        caseId,
        commentId
      )
      writeRequests.push({
        Put: {
          TableName: this.tableName,
          Item: {
            ...commentKey,
            updatedAt: now,
          },
        },
      })
    }

    // Add all files
    files.forEach((file) => {
      const fileKey = DynamoDbKeys.CASE_COMMENT_FILE(
        this.tenantId,
        caseId,
        commentId,
        file.s3Key
      )
      writeRequests.push({
        Put: {
          TableName: this.tableName,
          Item: {
            ...fileKey,
            ...file,
            caseId,
            commentId,
          },
        },
      })
    })

    if (updateHere) {
      const dynamoDbConsumerMessage = generateDynamoConsumerMessage(
        this.tenantId,
        [{ keyLists: keyLists, tableName: CASES_TABLE_NAME_CH }]
      )
      await transactWriteWithClickhouse(
        this.dynamoDb,
        writeRequests,
        dynamoDbConsumerMessage
      )
      return []
    }
    return writeRequests
  }

  /**
   * Updates the status of multiple cases
   *
   * @param caseIds - Array of case IDs to update
   * @param statusChange - The status change to apply
   * @param isLastInReview - Whether this is the last review status change
   * @returns Promise that resolves when updates are complete
   */
  public async updateStatus(
    caseIds: string[],
    statusChange: CaseStatusChange,
    isLastInReview?: boolean,
    lastStatusChangeUserIdCaseIdMap?: Map<string, string>
  ) {
    const now = Date.now()

    const operationsAndKeyLists = await Promise.all(
      caseIds.map(async (caseId) => {
        const caseItem = await this.getCaseById(caseId)
        if (!caseItem) {
          return { operations: [], keyLists: [] }
        }

        const lastStatusChangeUserId =
          lastStatusChangeUserIdCaseIdMap?.get(caseId)

        const updateExpressionParts = [
          'lastStatusChange = :statusChange',
          'updatedAt = :updatedAt',
          'caseStatus = :caseStatus',
          'statusChanges = list_append(if_not_exists(statusChanges, :empty_list), :statusChange)',
        ]

        const expressionAttributeValues: Record<string, NativeAttributeValue> =
          {
            ':statusChange': [statusChange],
            ':updatedAt': now,
            ':caseStatus': statusChange.caseStatus,
            ':empty_list': [],
          }

        if (isLastInReview) {
          const reviewerId = lastStatusChangeUserId

          updateExpressionParts.push('reviewerId = :reviewerId')
          expressionAttributeValues[':reviewerId'] = reviewerId
        } else {
          updateExpressionParts.push('userId = :userId')
          expressionAttributeValues[':userId'] = statusChange.userId
        }

        const updateExpression = 'SET ' + updateExpressionParts.join(', ')

        return await createUpdateCaseQueries(this.tenantId, this.tableName, {
          caseId,
          UpdateExpression: updateExpression,
          ExpressionAttributeValues: expressionAttributeValues,
          caseItem,
        })
      })
    )

    const operations = operationsAndKeyLists.flatMap(
      (result) => result.operations
    )
    const keyLists = operationsAndKeyLists.flatMap((result) => result.keyLists)

    // Create dynamic consumer message for Clickhouse
    const dynamoDbConsumerMessage: DynamoConsumerMessage[] =
      generateDynamoConsumerMessage(this.tenantId, [
        { keyLists: keyLists, tableName: CASES_TABLE_NAME_CH },
      ])

    await transactWriteWithClickhouse(
      this.dynamoDb,
      operations,
      dynamoDbConsumerMessage
    )
  }

  /**
   * Saves case transaction IDs to DynamoDB
   *
   * @param caseId - The ID of the case to save the transaction IDs for
   * @param caseTransactionIds - Array of transaction IDs to save
   * @returns Promise resolving to write operations
   */
  public async saveCaseTransactionIds(
    caseId: string,
    caseTransactionIds: string[]
  ): Promise<TransactWriteOperation[]> {
    if (!caseTransactionIds || caseTransactionIds.length === 0) {
      return []
    }
    const writeRequests: TransactWriteOperation[] = []
    const key = DynamoDbKeys.CASE_TRANSACTION_IDS(this.tenantId, caseId)
    writeRequests.push({
      Put: {
        TableName: this.tableName,
        Item: {
          ...key,
          caseTransactionIds,
        },
      },
    })
    return writeRequests
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
   * Updates assignments and/or review assignments for multiple cases
   *
   * @param caseIds - Array of case IDs to update
   * @param assignments - Optional new assignments to set
   * @param reviewAssignments - Optional new review assignments to set
   * @returns Promise that resolves when updates are complete
   */
  public async updateAssignmentsReviewAssignments(
    caseIds: string[],
    assignments?: Assignment[],
    reviewAssignments?: Assignment[]
  ): Promise<void> {
    const now = Date.now()

    let updateExpression = `SET updatedAt = :updatedAt`
    const expressionAttributeValues = {
      ':updatedAt': now,
    }
    if (assignments) {
      updateExpression += `, assignments = :assignments`
      expressionAttributeValues[':assignments'] = assignments
    }
    if (reviewAssignments) {
      updateExpression += `, reviewAssignments = :reviewAssignments`
      expressionAttributeValues[':reviewAssignments'] = reviewAssignments
    }

    const operationsAndKeyLists = await Promise.all(
      caseIds.map(async (caseId) => {
        const caseItem = await this.getCaseById(caseId)
        if (!caseItem) {
          return { operations: [], keyLists: [] }
        }
        return await createUpdateCaseQueries(this.tenantId, this.tableName, {
          caseId,
          UpdateExpression: updateExpression,
          ExpressionAttributeValues: expressionAttributeValues,
          caseItem,
        })
      })
    )

    const operations = operationsAndKeyLists.flatMap(
      (result) => result.operations
    )
    const keyLists = operationsAndKeyLists.flatMap((result) => result.keyLists)

    // Create dynamic consumer message for Clickhouse
    const dynamoDbConsumerMessage: DynamoConsumerMessage[] =
      generateDynamoConsumerMessage(this.tenantId, [
        { keyLists: keyLists, tableName: CASES_TABLE_NAME_CH },
      ])

    await transactWriteWithClickhouse(
      this.dynamoDb,
      operations,
      dynamoDbConsumerMessage
    )
  }

  /**
   * Copies review assignments to regular assignments for multiple cases
   * Used when promoting review assignments after approval
   *
   * @param caseIds - Array of case IDs to update
   * @returns Promise that resolves when updates are complete
   */
  public async updateReviewAssignmentsToAssignments(
    caseIds: string[]
  ): Promise<void> {
    const now = Date.now()

    const updateExpression = `SET assignments = reviewAssignments, updatedAt = :updatedAt`

    const expressionAttributeValues = {
      ':updatedAt': now,
    }
    const operationsAndKeyLists = await Promise.all(
      caseIds.map(async (caseId) => {
        const caseItem = await this.getCaseById(caseId)
        if (!caseItem) {
          return { operations: [], keyLists: [] }
        }
        return await createUpdateCaseQueries(this.tenantId, this.tableName, {
          caseId,
          UpdateExpression: updateExpression,
          ExpressionAttributeValues: expressionAttributeValues,
          caseItem,
        })
      })
    )
    const operations = operationsAndKeyLists.flatMap(
      (result) => result.operations
    )
    const keyLists = operationsAndKeyLists.flatMap((result) => result.keyLists)
    const dynamoDbConsumerMessage: DynamoConsumerMessage[] =
      generateDynamoConsumerMessage(this.tenantId, [
        { keyLists: keyLists, tableName: CASES_TABLE_NAME_CH },
      ])
    await transactWriteWithClickhouse(
      this.dynamoDb,
      operations,
      dynamoDbConsumerMessage
    )
  }

  /**
   * Retrieves multiple cases by their IDs
   *
   * @param caseIds - Array of case IDs to retrieve
   * @returns Promise resolving to an array of Case objects
   */
  public async getCases(caseIds: string[]): Promise<Case[]> {
    const cases = await batchGet<Case>(
      this.dynamoDb,
      this.tableName,
      caseIds.map((caseId) => DynamoDbKeys.CASE(this.tenantId, caseId))
    )

    const caseMap = cases.reduce((acc, item) => {
      const caseId = item.caseId as string
      acc[caseId] = omit(item, [
        'PartitionKeyID',
        'SortKeyID',
      ]) as CaseWithoutCaseTransactions
      return acc
    }, {} as Record<string, Case>)

    return caseIds.map((id) => caseMap[id]).filter(Boolean)
  }

  /**
   * Retrieves all comments associated with multiple cases
   *
   * @param caseIds - Array of case IDs to retrieve comments for
   * @returns Promise resolving to an array of Comment objects
   */
  public async getComments(caseIds: string[]): Promise<CaseCommentsInternal[]> {
    const queryPromises = caseIds.map((caseId) => {
      const partitionKey = DynamoDbKeys.CASE_COMMENT(
        this.tenantId,
        caseId,
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

    const comments: Comment[] = []
    results.forEach((result) => {
      if (result.Items) {
        comments.push(...(result.Items as Comment[]))
      }
    })

    return comments.map(
      (item) =>
        omit(item, ['PartitionKeyID', 'SortKeyID']) as CaseCommentsInternal
    )
  }

  /**
   * Retrieves files associated with comments in multiple cases
   *
   * @param caseIds - Array of case IDs to retrieve files for
   * @param commentId - Optional specific comment ID to filter files by
   * @returns Promise resolving to an array of FileInfo objects
   */
  public async getFiles(
    caseIds: string[],
    commentId?: string
  ): Promise<CaseCommentFileInternal[]> {
    const queryPromises = caseIds.map((caseId) => {
      const partitionKey = DynamoDbKeys.CASE_COMMENT_FILE(
        this.tenantId,
        caseId,
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

    const files: CaseCommentFileInternal[] = []
    results.forEach((result) => {
      if (result.Items) {
        files.push(...(result.Items as CaseCommentFileInternal[]))
      }
    })

    return files.map(
      (item) =>
        omit(item, ['PartitionKeyID', 'SortKeyID']) as CaseCommentFileInternal
    )
  }

  /**
   * Get cases by alert IDs
   * This method retrieves cases that have any of the specified alerts
   *
   * @param alertIds - Array of alert IDs to find cases for
   * @returns Promise resolving to an array of cases
   */
  public async getCasesByAlertIds(
    alertIds: string[]
  ): Promise<CaseWithoutCaseTransactions[]> {
    if (!alertIds.length) {
      return []
    }

    const alerts = await this.dynamoAlertRepository.getAlertsFromAlertIds(
      alertIds
    )

    const caseIds = [
      ...new Set(
        alerts.filter((alert) => alert?.caseId).map((alert) => alert.caseId)
      ),
    ] as string[]

    if (!caseIds.length) {
      return []
    }

    const cases = await this.getCasesFromCaseIds(caseIds, true, {
      joinAlerts: true,
      joinComments: true,
      joinFiles: true,
    })

    return cases
  }

  /**
   * Fetch cases from DynamoDB using case IDs
   * Optionally join alerts data, comments and files to the cases
   *
   * @param caseResults - Array of case IDs or case objects from ClickHouse
   * @param joinAlerts - Whether to join alert data from DynamoAlert repository
   * @returns Cases with optional alert data joined
   */
  public async getCasesFromCaseIds(
    caseResults: Case[] | string[],
    isCaseIds: boolean = true,
    {
      joinAlerts = false,
      joinComments = false,
      joinFiles = false,
    }: {
      joinAlerts?: boolean
      joinComments?: boolean
      joinFiles?: boolean
    } = {}
  ): Promise<Case[]> {
    // Extract case IDs from the results
    let cases: Case[] = caseResults as Case[]

    const caseIds = caseResults
      .map((result: any) =>
        typeof result === 'string' ? result : result.id ?? result.caseId
      )
      .filter(Boolean)

    if (caseIds.length === 0) {
      return []
    }
    if (isCaseIds) {
      // Get cases from DynamoDB
      cases = await this.getCases(caseIds)
    }
    if (joinComments) {
      const comments = await this.getComments(caseIds)
      cases = cases.map((caseItem) => ({
        ...caseItem,
        comments: comments.filter(
          (comment) => comment.caseId === caseItem.caseId
        ),
      }))
    }
    if (joinFiles) {
      const files = await this.getFiles(caseIds)
      cases = cases.map((caseItem) => ({
        ...caseItem,
        comments: caseItem.comments?.map((comment) => ({
          ...comment,
          files: files.filter(
            (file) =>
              file.caseId === caseItem.caseId && file.commentId === comment.id
          ),
        })),
      }))
    }
    // If not joining alerts, return cases
    if (!joinAlerts) {
      return cases
    }

    // Join alerts data if required
    const alertsData = await this.dynamoAlertRepository.getAlertsByCaseIds(
      caseIds
    )

    // Convert alerts data to a map with caseId as key
    const alertsByCaseId = alertsData.reduce((acc, alert) => {
      if (!acc[alert.caseId as string]) {
        acc[alert.caseId as string] = []
      }
      acc[alert.caseId as string].push(alert)
      return acc
    }, {} as Record<string, any[]>)

    // Join alerts to cases
    const caseMap = cases.reduce((acc, item) => {
      acc[item.caseId as string] = {
        ...item,
        alerts: alertsByCaseId[item.caseId as string] || item.alerts || [],
      }
      return acc
    }, {} as Record<string, Case>)
    return caseIds.map((id) => caseMap[id]).filter(Boolean)
  }

  /**
   * Get cases by subject ID using the generated checksum
   *
   * @param subjectId - Original subject identifier (userId or payment details identifier string)
   * @param params - Parameters for filtering cases
   * @returns Array of cases associated with the subject
   */
  private async getCasesBySubjectId(
    subjectId: string,
    params: SubjectCasesQueryParams,
    projectionExpression?: string
  ): Promise<Case[]> {
    const queryParams: QueryCommandInput & {
      ExpressionAttributeValues: Record<string, any>
    } = {
      TableName: this.tableName,
      KeyConditionExpression: 'PartitionKeyID = :pk',
      ExpressionAttributeValues: {
        ':pk': DynamoDbKeys.CASE_SUBJECT(this.tenantId, subjectId, '')
          .PartitionKeyID,
      },
    }

    if (projectionExpression) {
      queryParams.ProjectionExpression = projectionExpression
    }

    const filterExpressions: string[] = []

    if (params?.filterCaseType) {
      filterExpressions.push('caseType = :caseType')
      queryParams.ExpressionAttributeValues[':caseType'] = params.filterCaseType
    }

    if (params?.filterOutCaseStatus) {
      filterExpressions.push('caseStatus <> :filterOutCaseStatus')
      queryParams.ExpressionAttributeValues[':filterOutCaseStatus'] =
        params.filterOutCaseStatus
    }

    if (params?.filterAvailableAfterTimestamp?.length) {
      const timestampExpression = params.filterAvailableAfterTimestamp
        .map(
          (_, index) =>
            `availableAfterTimestamp = :availableAfterTimestamp${index}`
        )
        .join(' OR ')

      filterExpressions.push(`(${timestampExpression})`)

      params.filterAvailableAfterTimestamp.forEach((timestamp, index) => {
        queryParams.ExpressionAttributeValues[
          `:availableAfterTimestamp${index}`
        ] = timestamp ?? null
      })
    }

    if (params?.filterTransactionId) {
      filterExpressions.push('contains(caseTransactionsIds, :transactionId)')
      queryParams.ExpressionAttributeValues[':transactionId'] =
        params.filterTransactionId
    }

    if (filterExpressions.length > 0) {
      queryParams.FilterExpression = filterExpressions.join(' AND ')
    }

    const result = await paginateQuery(this.dynamoDb, queryParams)

    let cases = (result.Items || []).map(
      (item) => omit(item, ['PartitionKeyID', 'SortKeyID']) as Case
    )

    // Apply post-query filters that DynamoDB can't handle directly
    if (params?.filterMaxTransactions) {
      const maxTransactions = params.filterMaxTransactions
      cases = cases.filter(
        (caseItem) =>
          !caseItem.caseTransactionsIds ||
          caseItem.caseTransactionsIds.length < maxTransactions
      )
    }

    return cases
  }

  public async getCasesBySubject(
    subject: CaseSubject,
    params: SubjectCasesQueryParams
  ): Promise<Case[]> {
    const subjectId =
      subject.type === 'USER'
        ? `user:${subject.user.userId}`
        : `payment:${getPaymentDetailsIdentifiersSubject(
            subject.paymentDetails
          )}`
    if (!subjectId) {
      return []
    }
    const cases = await this.getCasesBySubjectId(subjectId, params)
    return this.getCasesFromCaseIds(cases, false, {
      joinAlerts: true,
      joinComments: true,
      joinFiles: true,
    })
  }

  /**
   * Prepares update operations for a case and its auxiliary indexes
   * @param caseId The ID of the case to update
   * @param updateFields fields to update (beyond updatedAt)
   * @returns Array of operations to use with transactWrite
   */
  async prepareCaseUpdates(
    caseId: string,
    updateFields: Record<string, any> = {},
    caseItem?: Case
  ): Promise<{
    writeRequests: TransactWriteOperation[]
    keyLists: dynamoKeyList
  }> {
    const now = Date.now()

    const fieldsToUpdate = {
      ...updateFields,
      updatedAt: now,
    }

    if (!caseItem) {
      caseItem = await this.getCaseById(caseId)
    }
    if (!caseItem) {
      throw new Error(`Case with ID ${caseId} not found`)
    }

    const { UpdateExpression, ExpressionAttributeValues } =
      getUpdateAttributesUpdateItemInput(fieldsToUpdate)

    const { operations, keyLists } = await createUpdateCaseQueries(
      this.tenantId,
      this.tableName,
      {
        caseId,
        UpdateExpression,
        ExpressionAttributeValues,
        caseItem,
      }
    )
    return { writeRequests: operations, keyLists }
  }

  /**
   * Get case IDs by user ID using the subject index
   * This is the DynamoDB implementation of the MongoDB-based getCaseIdsByUserId method
   *
   * @param userId - The user ID to get case IDs for
   * @param params - Optional parameters like caseType to filter the results
   * @returns Array of objects with caseId field
   */
  public async getCaseIdsByUserId(
    userId: string,
    params?: {
      caseType?: CaseType
    }
  ): Promise<{ caseId?: string }[]> {
    const queryParams: SubjectCasesQueryParams = {}

    if (params?.caseType) {
      queryParams.filterCaseType = params.caseType
    }

    const cases = await this.getCasesBySubjectId(
      `user:${userId}`,
      queryParams,
      'caseId'
    )

    return cases.map((caseItem) => ({
      caseId: caseItem.caseId,
    }))
  }

  /**
   * Get all transaction IDs associated with a case
   * This method retrieves transaction IDs from all alerts linked to the specified case
   *
   * @param caseId - The ID of the case to get transactions for
   * @returns Promise resolving to an array of transaction IDs
   */
  public async getCasesTransactions(caseId: string): Promise<string[]> {
    const partitionKey = DynamoDbKeys.CASE_ALERT(
      this.tenantId,
      caseId
    ).PartitionKeyID

    const queryInput: QueryCommandInput = {
      TableName: this.tableName,
      KeyConditionExpression: 'PartitionKeyID = :pk',
      ExpressionAttributeValues: {
        ':pk': partitionKey,
      },
      ProjectionExpression: 'transactionIds',
    }

    const result = await paginateQuery(this.dynamoDb, queryInput)

    const transactionIds =
      result.Items?.flatMap((alert) => alert.transactionIds || []) || []

    return [...new Set(transactionIds)]
  }

  /**
   * Get all transaction IDs associated with a user
   * This method first finds all cases associated with the user,
   * then retrieves transaction IDs from alerts linked to those cases
   *
   * @param userId - The ID of the user to get transactions for
   * @returns Promise resolving to an array of transaction IDs
   */
  public async getUserTransaction(userId: string): Promise<string[]> {
    const queryParams: QueryCommandInput = {
      TableName: this.tableName,
      KeyConditionExpression: 'PartitionKeyID = :pk',
      ExpressionAttributeValues: {
        ':pk': DynamoDbKeys.CASE_SUBJECT(this.tenantId, `user:${userId}`, '')
          .PartitionKeyID,
      },
      ProjectionExpression: 'caseId, caseUsers',
    }

    const result = await paginateQuery(this.dynamoDb, queryParams)

    if (!result.Items?.length) {
      return []
    }

    const caseIds = result.Items.map((item) => item.caseId)

    const alertQueriesPromises = caseIds.map((caseId) => {
      const partitionKey = DynamoDbKeys.CASE_ALERT(
        this.tenantId,
        caseId
      ).PartitionKeyID

      const queryInput: QueryCommandInput = {
        TableName: this.tableName,
        KeyConditionExpression: 'PartitionKeyID = :pk',
        ExpressionAttributeValues: {
          ':pk': partitionKey,
        },
        ProjectionExpression: 'alertId, transactionIds',
      }

      return paginateQuery(this.dynamoDb, queryInput)
    })

    const alertsResults = await Promise.all(alertQueriesPromises)

    const transactionIds = alertsResults
      .flatMap((result) => result.Items || [])
      .flatMap((alert) => alert.transactionIds || [])

    return [...new Set(transactionIds)]
  }

  /**
   * Updates the AI summary of a file in a comment
   *
   * @param caseId - The ID of the case containing the comment
   * @param commentId - The ID of the comment containing the file
   * @param fileS3Key - The S3 key of the file to update
   * @param summary - The AI summary to set for the file
   * @returns Promise that resolves when the update is complete
   */
  public async updateAISummary(
    caseId: string,
    commentId: string,
    fileS3Key: string,
    summary: string
  ) {
    const fileKey = DynamoDbKeys.CASE_COMMENT_FILE(
      this.tenantId,
      caseId,
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

    return this.prepareCaseUpdates(caseId).then(
      ({ writeRequests, keyLists }) => {
        const operations = [...writeRequests, fileUpdateOperation]

        const dynamoDbConsumerMessage: DynamoConsumerMessage[] =
          generateDynamoConsumerMessage(this.tenantId, [
            { keyLists: keyLists, tableName: CASES_TABLE_NAME_CH },
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
   * Update a manual case with new transactions and a comment
   *
   * @param caseId - The ID of the case to update
   * @param transactions - Array of transactions to add to the case
   * @param comment - Comment to add to the case
   * @param transactionsCount - Updated total count of transactions
   * @returns Promise resolving to the updated case or null if not found
   */
  public async updateManualCase(
    caseId: string,
    transactions: InternalTransaction[],
    comment: Comment,
    transactionsCount: number
  ): Promise<Case | null> {
    const caseItem = await this.getCaseById(caseId)
    if (!caseItem) {
      return null
    }

    const now = Date.now()

    const commentToSave: CaseCommentsInternal = {
      ...comment,
      caseId,
      createdAt: now,
      updatedAt: now,
    }

    const transactionIds = transactions.map(
      (transaction) => transaction.transactionId
    )

    const updateExpression = `
      SET updatedAt = :updatedAt, 
          caseTransactionsCount = :transactionsCount,
          caseTransactionsIds = list_append(if_not_exists(caseTransactionsIds, :empty_list), :transactionIds)
    `

    const expressionAttributeValues = {
      ':updatedAt': now,
      ':transactionsCount': transactionsCount,
      ':transactionIds': transactionIds,
      ':empty_list': [],
    }

    const { operations: caseOperations, keyLists } =
      await createUpdateCaseQueries(this.tenantId, this.tableName, {
        caseId,
        UpdateExpression: updateExpression,
        ExpressionAttributeValues: expressionAttributeValues,
        caseItem,
      })

    const commentOperations = await this.saveComments(
      caseId,
      [commentToSave],
      false
    )

    const operations = [...caseOperations, ...commentOperations]

    // Create dynamic consumer message for Clickhouse
    const dynamoDbConsumerMessage: DynamoConsumerMessage[] =
      generateDynamoConsumerMessage(this.tenantId, [
        { keyLists: keyLists, tableName: CASES_TABLE_NAME_CH },
      ])

    await transactWriteWithClickhouse(
      this.dynamoDb,
      operations,
      dynamoDbConsumerMessage
    )

    const updatedCase = await this.getCaseById(caseId)
    if (updatedCase) {
      const casesWithData = await this.getCasesFromCaseIds(
        [updatedCase],
        false,
        {
          joinAlerts: true,
          joinComments: true,
          joinFiles: true,
        }
      )

      return casesWithData[0] || null
    }

    return null
  }

  /**
   * Reassign cases from one user to another, incase of its deletion
   *
   * This method follows the MongoDB implementation's logic:
   * - For cases with a single assignment matching the assignee, replace that assignment
   * - For cases with multiple assignments, remove the assignee (don't add new one)
   *
   * @param assignmentId - The ID of the user currently assigned
   * @param reassignmentId - The ID of the user to reassign to
   */
  public async reassignCases(
    assignmentId: string,
    reassignmentId: string,
    caseIds: {
      assignments: { single: string[]; multiple: string[] }
      reviewAssignments: { single: string[]; multiple: string[] }
    }
  ): Promise<void> {
    const user = getContext()?.user as Account

    const newAssignment: Assignment = {
      assignedByUserId: user.id,
      assigneeUserId: reassignmentId,
      timestamp: Date.now(),
    }

    const singleAssignmentPromises: Promise<void>[] = []
    const multipleAssignmentPromises: Promise<void>[] = []

    // For cases with single assignment, replace with new assignment
    if (caseIds.assignments.single.length > 0) {
      for (const caseId of caseIds.assignments.single) {
        singleAssignmentPromises.push(
          this.updateAssignmentsReviewAssignments([caseId], [newAssignment])
        )
      }
    }

    // For cases with multiple assignments, remove the assignee
    if (caseIds.assignments.multiple.length > 0) {
      for (const caseId of caseIds.assignments.multiple) {
        const caseItem = await this.getCaseById(caseId)
        if (!caseItem || !caseItem.assignments) {
          continue
        }

        const filteredAssignments = caseItem.assignments.filter(
          (a) => a.assigneeUserId !== assignmentId
        )

        multipleAssignmentPromises.push(
          this.updateAssignmentsReviewAssignments([caseId], filteredAssignments)
        )
      }
    }

    // Process review assignments
    const singleReviewPromises: Promise<void>[] = []
    const multipleReviewPromises: Promise<void>[] = []

    // For cases with single review assignment, replace with new assignment
    if (caseIds.reviewAssignments.single.length > 0) {
      for (const caseId of caseIds.reviewAssignments.single) {
        singleReviewPromises.push(
          this.updateAssignmentsReviewAssignments([caseId], undefined, [
            newAssignment,
          ])
        )
      }
    }

    // For cases with multiple review assignments, remove the assignee
    if (caseIds.reviewAssignments.multiple.length > 0) {
      for (const caseId of caseIds.reviewAssignments.multiple) {
        const caseItem = await this.getCaseById(caseId)
        if (!caseItem || !caseItem.reviewAssignments) {
          continue
        }

        const filteredAssignments = caseItem.reviewAssignments.filter(
          (a) => a.assigneeUserId !== assignmentId
        )

        multipleReviewPromises.push(
          this.updateAssignmentsReviewAssignments(
            [caseId],
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
    ])
  }

  /**
   * Synchronize case user data when user data is updated
   * This updates all cases where the specified user appears as origin or destination
   *
   * @param newUser - The updated user data to sync to all relevant cases
   */
  public async syncCaseUsers(newUser: InternalUser): Promise<void> {
    const userId = newUser.userId

    const queryParams: QueryCommandInput = {
      TableName: this.tableName,
      KeyConditionExpression: 'PartitionKeyID = :pk',
      ExpressionAttributeValues: {
        ':pk': DynamoDbKeys.CASE_SUBJECT(this.tenantId, `user:${userId}`, '')
          .PartitionKeyID,
      },
      ProjectionExpression: 'caseId, caseUsers',
    }

    const result = await paginateQuery(this.dynamoDb, queryParams)

    if (!result.Items?.length) {
      return
    }
    const casesToUpdate = new Map<
      string,
      { isOrigin: boolean; isDestination: boolean }
    >()

    for (const item of result.Items) {
      const projectedItem = item as Pick<Case, 'caseId'> & {
        caseUsers?: {
          origin?: Pick<InternalUser, 'userId'>
          destination?: Pick<InternalUser, 'userId'>
        }
      }
      const caseId = projectedItem.caseId as string

      if (!caseId) {
        continue
      }

      let updateInfo = casesToUpdate.get(caseId)
      if (!updateInfo) {
        updateInfo = { isOrigin: false, isDestination: false }
        casesToUpdate.set(caseId, updateInfo)
      }

      if (projectedItem.caseUsers?.origin?.userId === userId) {
        updateInfo.isOrigin = true
      }
      if (projectedItem.caseUsers?.destination?.userId === userId) {
        updateInfo.isDestination = true
      }
    }

    const caseIdsToUpdate = Array.from(casesToUpdate.keys())
    if (caseIdsToUpdate.length === 0) {
      return
    }

    const now = Date.now()

    const allOperationsAndKeyLists = await Promise.all(
      caseIdsToUpdate.map(async (caseId) => {
        const updateInfo = casesToUpdate.get(caseId)
        if (!updateInfo) {
          return { operations: [], keyLists: [] }
        }
        const caseItem = await this.getCaseById(caseId)
        if (!caseItem) {
          return { operations: [], keyLists: [] }
        }

        const setClauses: string[] = ['updatedAt = :updatedAt']
        if (updateInfo.isOrigin) {
          setClauses.push('caseUsers.origin = :newUser')
        }
        if (updateInfo.isDestination) {
          setClauses.push('caseUsers.destination = :newUser')
        }
        const updateExpression = `SET ${setClauses.join(', ')}`

        const expressionAttributeValues = {
          ...(updateInfo.isOrigin || updateInfo.isDestination
            ? {
                ':newUser': newUser,
              }
            : {}),
          ':updatedAt': now,
        }

        return await createUpdateCaseQueries(this.tenantId, this.tableName, {
          caseId,
          UpdateExpression: updateExpression,
          ExpressionAttributeValues: expressionAttributeValues,
          caseItem,
        })
      })
    )

    const operations = allOperationsAndKeyLists.flatMap(
      (result) => result.operations
    )
    const keyLists = allOperationsAndKeyLists.flatMap(
      (result) => result.keyLists
    )

    if (operations.length > 0) {
      const dynamoDbConsumerMessage: DynamoConsumerMessage[] =
        generateDynamoConsumerMessage(this.tenantId, [
          { keyLists: keyLists, tableName: CASES_TABLE_NAME_CH },
        ])
      await transactWriteWithClickhouse(
        this.dynamoDb,
        operations,
        dynamoDbConsumerMessage
      )
    }
  }

  /**
   * Updates the SLA policy details for a case
   *
   * @param caseId - The ID of the case to update
   * @param slaPolicyDetails - The updated SLA policy details array
   *
   * We are not updating the updatedAt field here because we make the SLAPolicyDetails update
   * from our end and we do not want to make the user confused if they have not updated the object.
   *  - Jayant "Saheb" Patil
   *
   * @returns Promise that resolves when the update is complete
   */
  public async updateCaseSlaPolicyDetails(
    updates: SlaUpdates[]
  ): Promise<void> {
    const updateExpression = `SET slaPolicyDetails = :slaPolicyDetails`
    const caseIds = updates.map((u) => u.entityId)
    const caseItems = await this.getCases(caseIds)
    if (caseItems.length !== caseIds.length) {
      throw new Error(
        `Case with ID ${caseIds.find(
          (id) => !caseItems.find((c) => c.caseId === id)
        )} not found`
      )
    }
    const operations: TransactWriteOperation[] = []
    const keyLists: dynamoKeyList = []
    for (const update of updates) {
      const { operations: ops, keyLists: keys } = await createUpdateCaseQueries(
        this.tenantId,
        this.tableName,
        {
          caseId: update.entityId,
          UpdateExpression: updateExpression,
          ExpressionAttributeValues: {
            ':slaPolicyDetails': update.slaPolicyDetails,
          },
          caseItem: caseItems.find((c) => c.caseId === update.entityId),
        }
      )
      ops.map((op) => {
        operations.push(op)
      })
      keys.map((key) => {
        keyLists.push(key)
      })
    }

    const dynamoDbConsumerMessage: DynamoConsumerMessage[] =
      generateDynamoConsumerMessage(this.tenantId, [
        { keyLists: keyLists, tableName: CASES_TABLE_NAME_CH },
      ])

    await transactWriteWithClickhouse(
      this.dynamoDb,
      operations,
      dynamoDbConsumerMessage
    )

    logger.debug(`Updated SLA policy details for cases ${caseIds.join(', ')}`)
  }

  /**
   * Updates the dynamic risk score for a user across all associated cases.
   * Finds cases using the user subject index and updates both primary and auxiliary records.
   * Includes a check to ensure the relevant caseUser (origin or destination) exists before updating.
   *
   * @param userId - The ID of the user whose cases need updating
   * @param originDrsScore - The new DRS score for the origin user (if applicable)
   * @param destinationDrsScore - The new DRS score for the destination user (if applicable)
   * @param prefix - Indicates whether to update the 'origin' or 'destination' score
   */
  public async updateDynamicRiskScores(
    userId: string,
    originDrsScore: number | undefined | null,
    destinationDrsScore: number | undefined | null,
    prefix: 'origin' | 'destination'
  ): Promise<void> {
    const subjectId = `user:${userId}`
    const cases = await this.getCasesBySubjectId(
      subjectId,
      {},
      'caseId, caseUsers'
    )

    if (!cases || cases.length === 0) {
      logger.debug(`No cases found for user ${userId} to update DRS score.`)
      return
    }

    const now = Date.now()
    let updateExpression: string
    const expressionAttributeValues: Record<string, any> = { ':updatedAt': now }
    let scoreToUpdate: number | undefined | null = null

    if (prefix === 'origin' && originDrsScore != null) {
      updateExpression =
        'SET caseUsers.originUserDrsScore = :drsScore, updatedAt = :updatedAt'
      scoreToUpdate = originDrsScore
      expressionAttributeValues[':drsScore'] = scoreToUpdate
    } else if (prefix === 'destination' && destinationDrsScore != null) {
      updateExpression =
        'SET caseUsers.destinationUserDrsScore = :drsScore, updatedAt = :updatedAt'
      scoreToUpdate = destinationDrsScore
      expressionAttributeValues[':drsScore'] = scoreToUpdate
    } else {
      logger.warn(
        `No valid DRS score provided for prefix '${prefix}' for user ${userId}. Skipping update.`
      )
      return
    }

    const allOperationsAndKeyLists = await Promise.all(
      cases.map(async (caseInfo) => {
        const caseId = caseInfo.caseId
        if (!caseId) {
          return { operations: [], keyLists: [] }
        }

        const hasRelevantUser =
          (prefix === 'origin' &&
            caseInfo.caseUsers?.origin?.userId === userId) ||
          (prefix === 'destination' &&
            caseInfo.caseUsers?.destination?.userId === userId)

        if (!hasRelevantUser) {
          logger.warn(
            `Case ${caseId} does not have user ${userId} in the required '${prefix}' role. Skipping DRS update.`
          )
          return { operations: [], keyLists: [] }
        }

        const fullCaseItem = await this.getCaseById(caseId)
        if (!fullCaseItem) {
          logger.warn(
            `Full case data for ${caseId} not found during DRS update for user ${userId}. Skipping.`
          )
          return { operations: [], keyLists: [] }
        }

        return await createUpdateCaseQueries(this.tenantId, this.tableName, {
          caseId,
          UpdateExpression: updateExpression,
          ExpressionAttributeValues: expressionAttributeValues,
          caseItem: fullCaseItem,
        })
      })
    )

    const operations = allOperationsAndKeyLists.flatMap(
      (result) => result.operations
    )
    const keyLists = allOperationsAndKeyLists.flatMap(
      (result) => result.keyLists
    )

    if (operations.length > 0) {
      // Determine unique primary keys updated for logging purposes
      const primaryKeysUpdated = keyLists.filter(
        (k) =>
          k.key.SortKeyID === DynamoDbKeys.CASE(this.tenantId, '').SortKeyID
      )

      const dynamoDbConsumerMessage: DynamoConsumerMessage[] =
        generateDynamoConsumerMessage(this.tenantId, [
          { keyLists: keyLists, tableName: CASES_TABLE_NAME_CH },
        ])

      await transactWriteWithClickhouse(
        this.dynamoDb,
        operations,
        dynamoDbConsumerMessage
      )
      logger.debug(
        `Updated DRS score (${prefix}: ${scoreToUpdate}) for user ${userId} across ${primaryKeysUpdated.length} relevant cases.`
      )
    } else {
      logger.debug(
        `No valid operations generated for DRS update for user ${userId} (prefix: ${prefix}).`
      )
    }
  }

  /**
   * Soft deletes a comment and its child comments by setting the 'deletedAt' timestamp.
   * Also updates the 'updatedAt' timestamp on the parent case and its auxiliary items.
   *
   * @param caseId - The ID of the case containing the comment.
   * @param commentId - The ID of the comment to delete.
   */
  public async deleteCaseComment(
    caseId: string,
    commentId: string
  ): Promise<void> {
    const now = Date.now()

    const commentPartitionKey = DynamoDbKeys.CASE_COMMENT(
      this.tenantId,
      caseId,
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
        `No comments found with id or parentId ${commentId} in case ${caseId}`
      )
      return
    }

    let operations: TransactWriteOperation[] = []

    commentsToDelete.forEach((comment) => {
      const commentKey = DynamoDbKeys.CASE_COMMENT(
        this.tenantId,
        caseId,
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

    const caseItem = await this.getCaseById(caseId)
    if (!caseItem) {
      throw new Error(
        `Case with ID ${caseId} not found when trying to delete comment ${commentId}`
      )
    }

    const { operations: caseOperations, keyLists } =
      await createUpdateCaseQueries(this.tenantId, this.tableName, {
        caseId,
        UpdateExpression: 'SET updatedAt = :updatedAt',
        ExpressionAttributeValues: { ':updatedAt': now },
        caseItem,
      })

    operations = [...operations, ...caseOperations]

    const dynamoDbConsumerMessage: DynamoConsumerMessage[] =
      generateDynamoConsumerMessage(this.tenantId, [
        { keyLists: keyLists, tableName: CASES_TABLE_NAME_CH },
      ])

    await transactWriteWithClickhouse(
      this.dynamoDb,
      operations,
      dynamoDbConsumerMessage
    )
  }

  /**
   * Saves a comment to multiple cases.
   *
   * @param caseIds - Array of case IDs to save the comment to
   * @param comment - The comment to save
   * @returns Promise resolving to the saved comment
   */
  public async saveCasesComment(
    caseIds: string[],
    comment: Comment
  ): Promise<Comment> {
    const now = Date.now()
    const commentToSave: Comment = {
      ...comment,
      id: comment.id || uuidv4(),
      createdAt: now,
      updatedAt: now,
    }

    let allOperations: TransactWriteOperation[] = []
    let allKeyLists: dynamoKeyList = []

    const caseOperationsPromises = caseIds.map(async (caseId) => {
      const caseSpecificComment: CaseCommentsInternal = {
        ...commentToSave,
        caseId,
      }

      const commentOperations = await this.saveComments(
        caseId,
        [caseSpecificComment],
        false
      )

      const caseItem = await this.getCaseById(caseId)
      if (!caseItem) {
        logger.warn(
          `Case ${caseId} not found when trying to save comment ${commentToSave.id}`
        )
        return { operations: [], keyLists: [] }
      }

      const { operations: caseOperations, keyLists } =
        await createUpdateCaseQueries(this.tenantId, this.tableName, {
          caseId,
          UpdateExpression: 'SET updatedAt = :updatedAt',
          ExpressionAttributeValues: { ':updatedAt': now },
          caseItem,
        })

      return {
        operations: [...commentOperations, ...caseOperations],
        keyLists,
      }
    })

    const results = await Promise.all(caseOperationsPromises)

    results.forEach((result) => {
      allOperations = [...allOperations, ...result.operations]
      allKeyLists = [...allKeyLists, ...result.keyLists]
    })

    if (allOperations.length > 0) {
      const dynamoDbConsumerMessage: DynamoConsumerMessage[] =
        generateDynamoConsumerMessage(this.tenantId, [
          { keyLists: allKeyLists, tableName: CASES_TABLE_NAME_CH },
        ])

      await transactWriteWithClickhouse(
        this.dynamoDb,
        allOperations,
        dynamoDbConsumerMessage
      )
    }

    return commentToSave
  }
  /**
   * Marks all checklist items as done for a given case
   * @param caseIds - The list of case IDs to mark the checklist items for
   */
  public async markAllChecklistItemsAsDone(caseIds: string[]): Promise<void> {
    const alertIds = await this.dynamoAlertRepository.getAlertIdsByCaseIds(
      caseIds
    )
    await this.dynamoAlertRepository.markAllChecklistItemsAsDone(alertIds)
  }

  public async deleteCasesData(tenantId: string) {
    const partitionKeyId = DynamoDbKeys.CASE(tenantId, '').PartitionKeyID
    const queryInput: QueryCommandInput = {
      TableName: StackConstants.TARPON_DYNAMODB_TABLE_NAME(tenantId),
      KeyConditionExpression: 'PartitionKeyID = :pk',
      ExpressionAttributeValues: {
        ':pk': partitionKeyId,
      },
    }

    await dangerouslyQueryPaginateDelete<Case>(
      this.dynamoDb,
      tenantId,
      queryInput,
      (tenantId, caseItem) => {
        return this.deleteCase(tenantId, caseItem)
      }
    )
  }

  private async deleteCase(tenantId: string, caseItem: Case) {
    const caseId = caseItem.caseId as string
    const caseSubjectIdentifiers = caseItem.caseSubjectIdentifiers || ['']

    await Promise.all([
      dangerouslyDeletePartition(
        this.dynamoDb,
        tenantId,
        DynamoDbKeys.CASE_COMMENT(tenantId, caseId, '').PartitionKeyID,
        StackConstants.TARPON_DYNAMODB_TABLE_NAME(tenantId),
        'Case Comment'
      ),
      dangerouslyDeletePartition(
        this.dynamoDb,
        tenantId,
        DynamoDbKeys.CASE_COMMENT_FILE(tenantId, caseId, '', '').PartitionKeyID,
        StackConstants.TARPON_DYNAMODB_TABLE_NAME(tenantId),
        'Case Comment File'
      ),
      caseSubjectIdentifiers.map((identifier) => {
        return dangerouslyDeletePartition(
          this.dynamoDb,
          tenantId,
          DynamoDbKeys.CASE_SUBJECT(tenantId, identifier, '').PartitionKeyID,
          StackConstants.TARPON_DYNAMODB_TABLE_NAME(tenantId),
          'Case Subject'
        )
      }),
      dangerouslyDeletePartition(
        this.dynamoDb,
        tenantId,
        DynamoDbKeys.CASE_ALERT(tenantId, caseId, '').PartitionKeyID,
        StackConstants.TARPON_DYNAMODB_TABLE_NAME(tenantId),
        'Case Alert'
      ),
      dangerouslyDeletePartitionKey(
        this.dynamoDb,
        DynamoDbKeys.CASE(tenantId, caseId),
        StackConstants.TARPON_DYNAMODB_TABLE_NAME(tenantId)
      ),
    ])
  }
}
