import {
  DynamoDBDocumentClient,
  QueryCommand,
  GetCommand,
  PutCommand,
  UpdateCommand,
} from '@aws-sdk/lib-dynamodb'
import { MongoClient } from 'mongodb'
import { NotFound, BadRequest } from 'http-errors'
import { StackConstants } from '@lib/constants'
import { DynamoDbKeys } from '@/core/dynamodb/dynamodb-keys'
import { CaseWorkflow } from '@/@types/openapi-internal/CaseWorkflow'
import { AlertWorkflow } from '@/@types/openapi-internal/AlertWorkflow'
import { ApprovalWorkflow } from '@/@types/openapi-internal/ApprovalWorkflow'
import { WorkflowType } from '@/@types/openapi-internal/WorkflowType'
import { getContext } from '@/core/utils/context-storage'
import { FLAGRIGHT_SYSTEM_USER } from '@/utils/user'
import { CounterRepository, CounterEntity } from '@/services/counter/repository'
import { tenantSettings } from '@/core/utils/context'
import { RiskRepository } from '@/services/risk-scoring/repositories/risk-repository'
import { UserRepository } from '@/services/users/repositories/user-repository'
import { RiskService } from '@/services/risk'
import { UserService } from '@/services/users'

interface WorkflowServiceDeps {
  dynamoDb: DynamoDBDocumentClient
  mongoDb: MongoClient
}

export type Workflow = CaseWorkflow | AlertWorkflow | ApprovalWorkflow

type InternalWorkflow = Workflow & {
  PartitionKeyID: string
  SortKeyID: string
}

/**
 * Helper function to convert camelCase string to readable format
 * Examples:
 *   "riskLevelsApprovalWorkflow" -> "Risk Levels Approval Workflow"
 *   "eoddDate" -> "Eodd Date"
 */
function formatCamelCaseToReadable(text: string): string {
  return text
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (str) => str.toUpperCase())
    .trim()
}

/**
 * Checks if a workflow is referenced in tenant workflow settings
 * @returns Object containing arrays of direct references and user fields
 */
function findWorkflowReferences(
  workflowSettings: any,
  workflowId: string
): { directReferences: string[]; userFields: string[] } {
  const directReferences: string[] = []
  const userFields: string[] = []

  if (!workflowSettings) {
    return { directReferences, userFields }
  }

  for (const [settingKey, settingValue] of Object.entries(workflowSettings)) {
    if (typeof settingValue === 'string' && settingValue === workflowId) {
      // Direct reference (e.g., riskLevelsApprovalWorkflow, riskFactorsApprovalWorkflow)
      const readableName = formatCamelCaseToReadable(settingKey).replace(
        /Approval$/,
        ''
      ) // Remove redundant "Approval" suffix
      directReferences.push(readableName)
    } else if (typeof settingValue === 'object' && settingValue !== null) {
      // Nested object (e.g., userApprovalWorkflows)
      for (const [nestedKey, nestedValue] of Object.entries(settingValue)) {
        if (nestedValue === workflowId) {
          if (settingKey === 'userApprovalWorkflows') {
            // Format user field names
            userFields.push(formatCamelCaseToReadable(nestedKey))
          } else {
            // Generic fallback for other nested objects
            const parentName = formatCamelCaseToReadable(settingKey)
            directReferences.push(`${parentName}: ${nestedKey}`)
          }
        }
      }
    }
  }

  return { directReferences, userFields }
}

/**
 * Formats workflow setting references into a user-friendly error message
 */
function formatWorkflowReferences(
  workflowId: string,
  directReferences: string[],
  userFields: string[]
): string {
  const parts: string[] = []

  // Add direct references
  if (directReferences.length > 0) {
    parts.push(...directReferences)
  }

  // Add grouped user fields
  if (userFields.length > 0) {
    parts.push(`User Field Approval (${userFields.join(', ')})`)
  }

  return `Cannot disable workflow ${workflowId} because it is currently used in settings for the following actions:\n\n${parts.join(
    ', '
  )}.`
}

export class WorkflowService {
  private readonly docClient: DynamoDBDocumentClient
  private readonly tableName: string
  private readonly counterRepo: CounterRepository

  private cleanWorkflow(workflow: InternalWorkflow): Workflow {
    const {
      PartitionKeyID: _partitionKeyID,
      SortKeyID: _sortKeyID,
      ...cleanWorkflow
    } = workflow
    return cleanWorkflow
  }

  constructor(
    private readonly tenantId: string,
    private readonly deps: WorkflowServiceDeps
  ) {
    this.docClient = deps.dynamoDb
    this.tableName = StackConstants.TARPON_DYNAMODB_TABLE_NAME(tenantId)
    this.counterRepo = new CounterRepository(tenantId, {
      mongoDb: deps.mongoDb,
      dynamoDb: deps.dynamoDb,
    })
  }

  private async getNextWorkflowId(workflowType: WorkflowType): Promise<string> {
    // Special handling for change-approval to avoid conflict with case (WC)
    if (workflowType === 'change-approval') {
      const nextNumber = await this.counterRepo.getNextCounterAndUpdate(
        'WorkflowChangeApproval'
      )
      return `WCA-${nextNumber}`
    }

    // build the prefix from the workflow type (first letter capitalized)
    const prefix = `W${workflowType.charAt(0).toUpperCase()}`
    // build the counter entity from the workflow type (ie: case -> WorkflowCase)
    const counterEntity = ('Workflow' +
      workflowType.charAt(0).toUpperCase() +
      workflowType.slice(1)) as CounterEntity
    const nextNumber = await this.counterRepo.getNextCounterAndUpdate(
      counterEntity
    )
    return `${prefix}-${nextNumber}`
  }

  async getWorkflows(workflowType?: WorkflowType): Promise<Workflow[]> {
    const workflowTypes: WorkflowType[] = workflowType
      ? [workflowType]
      : ['case', 'alert', 'change-approval'] // Include unified approval workflows

    const results = await Promise.all(
      workflowTypes.map(async (type) => {
        const queryInput = {
          TableName: this.tableName,
          KeyConditionExpression: 'PartitionKeyID = :pk',
          ExpressionAttributeValues: {
            ':pk': DynamoDbKeys.WORKFLOWS(this.tenantId, type).PartitionKeyID,
          },
          ScanIndexForward: false,
        }

        const result = await this.docClient.send(new QueryCommand(queryInput))
        return result.Items || []
      })
    )

    // Flatten results from all workflow types
    const allItems = results.flat()
    if (!allItems.length) {
      return []
    }

    // Get unique workflows (latest version only)
    const workflowMap = new Map<string, InternalWorkflow>()
    for (const item of allItems) {
      const workflowId = item.SortKeyID.split('#')[0]
      if (!workflowMap.has(workflowId)) {
        workflowMap.set(workflowId, item as InternalWorkflow)
      }
    }

    return Array.from(workflowMap.values()).map((workflow) =>
      this.cleanWorkflow(workflow)
    )
  }

  async getWorkflow(
    workflowType: WorkflowType,
    workflowId: string
  ): Promise<Workflow> {
    const queryInput = {
      TableName: this.tableName,
      KeyConditionExpression:
        'PartitionKeyID = :pk AND begins_with(SortKeyID, :sk)',
      ExpressionAttributeValues: {
        ':pk': DynamoDbKeys.WORKFLOWS(this.tenantId, workflowType)
          .PartitionKeyID,
        ':sk': `${workflowId}#`,
      },
      ScanIndexForward: false,
      Limit: 1,
    }

    const result = await this.docClient.send(new QueryCommand(queryInput))
    if (!result.Items?.length) {
      throw new NotFound(`Workflow ${workflowId} not found`)
    }

    const workflow = result.Items[0] as InternalWorkflow
    return this.cleanWorkflow(workflow)
  }

  async getWorkflowVersion(
    workflowType: WorkflowType,
    workflowId: string,
    version: number
  ): Promise<Workflow> {
    const getInput = {
      TableName: this.tableName,
      Key: DynamoDbKeys.WORKFLOWS(
        this.tenantId,
        workflowType,
        workflowId,
        version.toString() // DynamoDB keys require strings
      ),
      ConsistentRead: true,
    }

    const result = await this.docClient.send(new GetCommand(getInput))
    if (!result.Item) {
      throw new NotFound(`Workflow ${workflowId} version ${version} not found`)
    }

    const workflow = result.Item as InternalWorkflow
    return this.cleanWorkflow(workflow)
  }

  async getWorkflowHistory(
    workflowType: WorkflowType,
    workflowId: string
  ): Promise<Workflow[]> {
    const queryInput = {
      TableName: this.tableName,
      KeyConditionExpression:
        'PartitionKeyID = :pk AND begins_with(SortKeyID, :sk)',
      ExpressionAttributeValues: {
        ':pk': DynamoDbKeys.WORKFLOWS(this.tenantId, workflowType)
          .PartitionKeyID,
        ':sk': `${workflowId}#`,
      },
      ScanIndexForward: false,
    }

    const result = await this.docClient.send(new QueryCommand(queryInput))
    return (result.Items || []).map((workflow) =>
      this.cleanWorkflow(workflow as InternalWorkflow)
    ) as Workflow[]
  }

  async saveWorkflow(
    workflowType: WorkflowType,
    workflowId: string | undefined,
    workflow: Workflow
  ): Promise<Workflow> {
    const version = Date.now()
    const finalWorkflowId =
      workflowId || (await this.getNextWorkflowId(workflowType))
    const author = getContext()?.user?.id || FLAGRIGHT_SYSTEM_USER

    const item = {
      ...workflow,
      id: finalWorkflowId,
      version,
      workflowType,
      author,
      ...DynamoDbKeys.WORKFLOWS(
        this.tenantId,
        workflowType,
        finalWorkflowId,
        version.toString()
      ),
    }

    await this.docClient.send(
      new PutCommand({
        TableName: this.tableName,
        Item: item,
      })
    )

    return this.cleanWorkflow(item as InternalWorkflow)
  }

  /**
   * Updates all pending approvals to use a new workflow version
   * This is called when a workflow is updated (new version created)
   *
   * For change-approval workflows, this method:
   * - Queries tenant settings to determine which approval contexts use this workflow
   * - Updates risk level approvals if this workflow is configured for risk levels
   * - Updates risk factor approvals if this workflow is configured for risk factors
   * - Updates user approvals if this workflow is configured for any user fields
   * - Returns the total count of updated approvals
   */
  async updatePendingApprovalsForWorkflow(
    workflowType: WorkflowType,
    newWorkflowRef: { id: string; version: number }
  ): Promise<number> {
    // Update pending approvals based on workflow type
    switch (workflowType) {
      case 'change-approval': {
        console.log(
          `Updating pending approvals for unified workflow ${newWorkflowRef.id} to version ${newWorkflowRef.version}`
        )

        // Get tenant settings to determine which approval contexts use this workflow
        const settings = await tenantSettings(this.tenantId)
        if (!settings?.workflowSettings) {
          console.log('No workflow settings found in tenant settings')
          return 0
        }

        let totalUpdated = 0
        const { workflowSettings } = settings

        // Initialize repositories
        const riskRepository = new RiskRepository(this.tenantId, {
          dynamoDb: this.deps.dynamoDb,
          mongoDb: this.deps.mongoDb,
        })
        const userRepository = new UserRepository(this.tenantId, {
          dynamoDb: this.deps.dynamoDb,
          mongoDb: this.deps.mongoDb,
        })

        // Check if this workflow is used for risk levels approval
        if (workflowSettings.riskLevelsApprovalWorkflow === newWorkflowRef.id) {
          console.log(
            `Workflow ${newWorkflowRef.id} is used for risk levels approval`
          )
          const updated =
            await riskRepository.bulkUpdateRiskLevelApprovalsWorkflow(
              newWorkflowRef
            )
          console.log(`Updated ${updated} risk level approval(s)`)
          totalUpdated += updated
        }

        // Check if this workflow is used for risk factors approval
        if (
          workflowSettings.riskFactorsApprovalWorkflow === newWorkflowRef.id
        ) {
          console.log(
            `Workflow ${newWorkflowRef.id} is used for risk factors approval`
          )
          const updated =
            await riskRepository.bulkUpdateRiskFactorApprovalsWorkflow(
              newWorkflowRef
            )
          console.log(`Updated ${updated} risk factor approval(s)`)
          totalUpdated += updated
        }

        // Check if this workflow is used for any user field approvals
        const userApprovalWorkflows = workflowSettings.userApprovalWorkflows
        if (userApprovalWorkflows) {
          const userFields: string[] = []
          for (const [field, workflowId] of Object.entries(
            userApprovalWorkflows
          )) {
            if (workflowId === newWorkflowRef.id) {
              userFields.push(field)
            }
          }

          if (userFields.length > 0) {
            console.log(
              `Workflow ${
                newWorkflowRef.id
              } is used for user field(s): ${userFields.join(', ')}`
            )
            const updated =
              await userRepository.bulkUpdateUserApprovalsWorkflow(
                newWorkflowRef
              )
            console.log(`Updated ${updated} user approval(s)`)
            totalUpdated += updated
          }
        }

        console.log(
          `Total pending approvals updated for workflow ${newWorkflowRef.id}: ${totalUpdated}`
        )
        return totalUpdated
      }
      default:
        // Other workflow types (case, alert) don't have pending approvals to update
        return 0
    }
  }

  async patchWorkflowEnabled(
    workflowType: WorkflowType,
    workflowId: string,
    enabled: boolean
  ): Promise<void> {
    // Get the latest workflow version to get the current version number
    const workflow = await this.getWorkflow(workflowType, workflowId)
    if (!workflow) {
      throw new NotFound('Workflow not found')
    }

    // If disabling a change-approval workflow, check if it's referenced in tenant settings
    if (!enabled && workflowType === 'change-approval') {
      const settings = await tenantSettings(this.tenantId)
      const { directReferences, userFields } = findWorkflowReferences(
        settings.workflowSettings,
        workflowId
      )

      // Throw error if workflow is in use
      if (directReferences.length > 0 || userFields.length > 0) {
        throw new BadRequest(
          formatWorkflowReferences(workflowId, directReferences, userFields)
        )
      }
    }

    // Perform partial update to only modify the enabled field
    const updateInput = {
      TableName: this.tableName,
      Key: DynamoDbKeys.WORKFLOWS(
        this.tenantId,
        workflowType,
        workflowId,
        workflow.version.toString()
      ),
      UpdateExpression: 'SET enabled = :enabled',
      ExpressionAttributeValues: {
        ':enabled': enabled,
      },
      ReturnValues: 'ALL_NEW' as const,
    }

    await this.docClient.send(new UpdateCommand(updateInput))
  }

  async getUniqueStatuses(workflowType: WorkflowType): Promise<string[]> {
    // Get all versions of all workflows of the given type
    const queryInput = {
      TableName: this.tableName,
      KeyConditionExpression: 'PartitionKeyID = :pk',
      ExpressionAttributeValues: {
        ':pk': DynamoDbKeys.WORKFLOWS(this.tenantId, workflowType)
          .PartitionKeyID,
      },
      ScanIndexForward: false,
    }

    const result = await this.docClient.send(new QueryCommand(queryInput))
    const allItems = result.Items || []

    const statusesSet = new Set<string>()
    for (const item of allItems) {
      if (item.statuses && Array.isArray(item.statuses)) {
        item.statuses.forEach((status: string) => statusesSet.add(status))
      }
    }

    return Array.from(statusesSet)
  }

  /**
   * Auto-applies pending approvals when a workflow is disabled or deleted
   * This is called when a workflow is removed from the system
   *
   * For change-approval workflows, this method:
   * - Queries tenant settings to determine which approval contexts use this workflow
   * - Auto-applies risk level approvals if this workflow was configured for risk levels
   * - Auto-applies risk factor approvals if this workflow was configured for risk factors
   * - Auto-applies user approvals if this workflow was configured for any user fields
   * - Returns the total count of auto-applied approvals
   */
  async autoApplyPendingApprovalsForRemovedWorkflows(
    workflowType: WorkflowType,
    workflowId: string,
    fieldsWithRemovedWorkflows?: string[]
  ): Promise<number> {
    console.log(
      `Auto-applying pending approvals for removed workflow ${workflowId} of type: ${workflowType}`
    )

    // Auto-apply pending approvals based on workflow type
    switch (workflowType) {
      case 'change-approval': {
        console.log(
          `Determining which approval contexts use workflow ${workflowId}`
        )

        // Get tenant settings to determine which approval contexts use this workflow
        const settings = await tenantSettings(this.tenantId)
        if (!settings?.workflowSettings) {
          console.log('No workflow settings found in tenant settings')
          return 0
        }

        let totalAutoApplied = 0
        const { workflowSettings } = settings

        // Initialize repositories
        const riskService = new RiskService(this.tenantId, {
          dynamoDb: this.deps.dynamoDb,
          mongoDb: this.deps.mongoDb,
        })
        const userService = new UserService(this.tenantId, {
          dynamoDb: this.deps.dynamoDb,
          mongoDb: this.deps.mongoDb,
        })

        // Check if this workflow was used for risk levels approval
        if (workflowSettings.riskLevelsApprovalWorkflow === workflowId) {
          console.log(
            `Workflow ${workflowId} was used for risk levels approval`
          )
          const applied = await riskService.autoApplyPendingRiskLevelApprovals()
          console.log(`Auto-applied ${applied} risk level approval(s)`)
          totalAutoApplied += applied
        }

        // Check if this workflow was used for risk factors approval
        if (workflowSettings.riskFactorsApprovalWorkflow === workflowId) {
          console.log(
            `Workflow ${workflowId} was used for risk factors approval`
          )
          const applied =
            await riskService.autoApplyPendingRiskFactorApprovals()
          console.log(`Auto-applied ${applied} risk factor approval(s)`)
          totalAutoApplied += applied
        }

        // Check if this workflow was used for any user field approvals
        const userApprovalWorkflows = workflowSettings.userApprovalWorkflows
        if (userApprovalWorkflows && fieldsWithRemovedWorkflows) {
          const userFields: string[] = []
          for (const [field, wfId] of Object.entries(userApprovalWorkflows)) {
            if (
              wfId === workflowId &&
              fieldsWithRemovedWorkflows.includes(field)
            ) {
              userFields.push(field)
            }
          }

          if (userFields.length > 0) {
            console.log(
              `Workflow ${workflowId} was used for user field(s): ${userFields.join(
                ', '
              )}`
            )
            const applied = await userService.autoApplyPendingUserApprovals(
              userFields
            )
            console.log(`Auto-applied ${applied} user approval(s)`)
            totalAutoApplied += applied
          }
        }

        console.log(
          `Total pending approvals auto-applied for workflow ${workflowId}: ${totalAutoApplied}`
        )
        return totalAutoApplied
      }
      default:
        // Other workflow types don't have pending approvals to auto-apply
        console.log(`No auto-apply logic for workflow type ${workflowType}`)
        return 0
    }
  }
}
