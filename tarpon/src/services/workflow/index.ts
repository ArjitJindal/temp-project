import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import {
  DynamoDBDocumentClient,
  QueryCommand,
  GetCommand,
  PutCommand,
} from '@aws-sdk/lib-dynamodb'
import { MongoClient } from 'mongodb'
import { NotFound } from 'http-errors'
import { StackConstants } from '@lib/constants'
import { DynamoDbKeys } from '@/core/dynamodb/dynamodb-keys'
import { CaseWorkflow } from '@/@types/openapi-internal/CaseWorkflow'
import { AlertWorkflow } from '@/@types/openapi-internal/AlertWorkflow'
import { WorkflowType } from '@/@types/openapi-internal/WorkflowType'
import { getContext } from '@/core/utils/context-storage'
import { FLAGRIGHT_SYSTEM_USER } from '@/utils/user'
import { CounterRepository, CounterEntity } from '@/services/counter/repository'

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
    this.docClient = DynamoDBDocumentClient.from(deps.dynamoDb)
    this.tableName = StackConstants.TARPON_DYNAMODB_TABLE_NAME(tenantId)
    this.counterRepo = new CounterRepository(tenantId, {
      mongoDb: deps.mongoDb,
      dynamoDb: deps.dynamoDb,
    })
  }

  private async getNextWorkflowId(workflowType: WorkflowType): Promise<string> {
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
        version.toString()
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
}
