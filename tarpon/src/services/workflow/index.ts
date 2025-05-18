import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import {
  DynamoDBDocumentClient,
  QueryCommand,
  GetCommand,
  PutCommand,
} from '@aws-sdk/lib-dynamodb'
import { MongoClient } from 'mongodb'
import { NotFound } from 'http-errors'
import { nanoid } from 'nanoid'
import { StackConstants } from '@lib/constants'
import { DynamoDbKeys } from '@/core/dynamodb/dynamodb-keys'
import { CaseWorkflow } from '@/@types/openapi-internal/CaseWorkflow'
import { AlertWorkflow } from '@/@types/openapi-internal/AlertWorkflow'
import { WorkflowType } from '@/@types/openapi-internal/WorkflowType'

function generateUniqueId(): string {
  return nanoid()
}

interface WorkflowServiceDeps {
  dynamoDb: DynamoDBClient
  mongoDb: MongoClient
}

type Workflow = CaseWorkflow | AlertWorkflow
type InternalWorkflow = Workflow & {
  PartitionKeyID: string
  SortKeyID: string
}

export class WorkflowService {
  private readonly docClient: DynamoDBDocumentClient
  private readonly tableName: string

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
    this.docClient = DynamoDBDocumentClient.from(deps.dynamoDb)
    this.tableName = StackConstants.TARPON_DYNAMODB_TABLE_NAME(tenantId)
  }

  async getWorkflows(workflowType?: WorkflowType): Promise<Workflow[]> {
    const workflowTypes: WorkflowType[] = workflowType
      ? [workflowType]
      : ['case', 'alert']

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
    version: string
  ): Promise<Workflow> {
    const getInput = {
      TableName: this.tableName,
      Key: DynamoDbKeys.WORKFLOWS(
        this.tenantId,
        workflowType,
        workflowId,
        version
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
    const version = Date.now().toString()
    const finalWorkflowId = workflowId || generateUniqueId()

    const item = {
      ...workflow,
      id: finalWorkflowId,
      version,
      workflowType,
      ...DynamoDbKeys.WORKFLOWS(
        this.tenantId,
        workflowType,
        finalWorkflowId,
        version
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
}
