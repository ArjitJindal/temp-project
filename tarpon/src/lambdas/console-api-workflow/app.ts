import {
  APIGatewayEventLambdaAuthorizerContext,
  APIGatewayProxyWithLambdaAuthorizerEvent,
} from 'aws-lambda'
import { BadRequest } from 'http-errors'
import {
  CaseWorkflowMachine,
  AlertWorkflowMachine,
  RiskLevelApprovalWorkflowMachine,
} from '@flagright/lib/classes/workflow-machine'
import { JWTAuthorizerResult } from '@/@types/jwt'
import { Handlers } from '@/@types/openapi-internal-custom/DefaultApi'
import { lambdaApi } from '@/core/middlewares/lambda-api-middlewares'
import { WorkflowService } from '@/services/workflow'
import { getDynamoDbClientByEvent } from '@/utils/dynamodb'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import { CaseWorkflow } from '@/@types/openapi-internal/CaseWorkflow'
import { AlertWorkflow } from '@/@types/openapi-internal/AlertWorkflow'
import { RiskLevelApprovalWorkflow } from '@/@types/openapi-internal/RiskLevelApprovalWorkflow'
import { WorkflowType } from '@/@types/openapi-internal/WorkflowType'

type GenericWorkflow = CaseWorkflow | AlertWorkflow | RiskLevelApprovalWorkflow

function parseWorkflow(request): GenericWorkflow {
  let workflow: GenericWorkflow
  // TODO: fix this!
  const inlineObject = request.CreateWorkflowType || request.UpdateWorkflowType

  if (request.workflowType === 'case') {
    workflow = inlineObject.caseWorkflow as CaseWorkflow
    try {
      CaseWorkflowMachine.validate(workflow)
    } catch (error) {
      throw new BadRequest(
        'Invalid workflow definition: ' + (error as Error).message
      )
    }
  } else if (request.workflowType === 'alert') {
    workflow = inlineObject.alertWorkflow as AlertWorkflow
    try {
      AlertWorkflowMachine.validate(workflow)
    } catch (error) {
      throw new BadRequest(
        'Invalid workflow definition: ' + (error as Error).message
      )
    }
  } else if (request.workflowType === 'risk-levels-approval') {
    workflow =
      inlineObject.riskLevelApprovalWorkflow as RiskLevelApprovalWorkflow
    try {
      RiskLevelApprovalWorkflowMachine.validate(workflow)
    } catch (error) {
      throw new BadRequest(
        'Invalid workflow definition: ' + (error as Error).message
      )
    }
    // } else if (request.workflowType === 'rule-approval') {
    //   workflow = inlineObject.ruleApprovalWorkflow as RuleApprovalWorkflow
  } else {
    throw new BadRequest('Invalid workflow type')
  }

  return workflow
}

export const workflowHandler = lambdaApi()(
  async (
    event: APIGatewayProxyWithLambdaAuthorizerEvent<
      APIGatewayEventLambdaAuthorizerContext<JWTAuthorizerResult>
    >
  ) => {
    const { principalId: tenantId } = event.requestContext.authorizer
    const dynamoDb = getDynamoDbClientByEvent(event)
    const mongoDb = await getMongoDbClient()

    const workflowService = new WorkflowService(tenantId, { dynamoDb, mongoDb })
    const handlers = new Handlers()

    // Get all workflows
    handlers.registerGetAllWorkflows(async (_ctx, request) => {
      const type = request.workflowType as WorkflowType
      return await workflowService.getWorkflows(type)
    })

    // Get workflow by ID
    handlers.registerGetWorkflowById(async (_ctx, request) => {
      return await workflowService.getWorkflow(
        request.workflowType as WorkflowType,
        request.workflowId
      )
    })

    handlers.registerCreateWorkflow(async (_ctx, request) => {
      const workflow = parseWorkflow(request)
      return await workflowService.saveWorkflow(
        request.workflowType as WorkflowType,
        undefined,
        workflow
      )
    })

    handlers.registerPostWorkflowVersion(async (_ctx, request) => {
      const workflow = parseWorkflow(request)
      return await workflowService.saveWorkflow(
        request.workflowType as WorkflowType,
        request.workflowId,
        workflow
      )
    })

    // Get specific version of workflow
    handlers.registerGetWorkflowVersion(async (_ctx, request) => {
      return await workflowService.getWorkflowVersion(
        request.workflowType as WorkflowType,
        request.workflowId,
        request.version
      )
    })

    // Get workflow history
    handlers.registerGetWorkflowHistory(async (_ctx, request) => {
      return await workflowService.getWorkflowHistory(
        request.workflowType as WorkflowType,
        request.workflowId
      )
    })

    // Get all workflows of all types
    handlers.registerGetAllWorkflowTypes(async (_ctx, request) => {
      const workflows = await workflowService.getWorkflows(request.type)
      return { workflows }
    })

    handlers.registerGetWorkflowVersionsBulk(async (_ctx, request) => {
      const requestedWorkflows =
        request.GetWorkflowVersionsBulkRequest.workflows
      const workflowPromises = requestedWorkflows.map(async (item) => {
        try {
          return await workflowService.getWorkflowVersion(
            item.type,
            item.id,
            item.version
          )
        } catch (error) {
          return null
        }
      })

      const workflows = (await Promise.all(workflowPromises)).filter(
        (workflow): workflow is NonNullable<typeof workflow> =>
          workflow !== null
      )

      return workflows
    })

    handlers.registerPatchWorkflowEnabled(async (_ctx, request) => {
      return await workflowService.patchWorkflowEnabled(
        request.workflowType as WorkflowType,
        request.workflowId,
        request.UpdateWorkflowEnabledRequest.enabled
      )
    })

    handlers.registerGetUniqueStatusesByType(async (_ctx, request) => {
      if (request.workflowType !== 'case' && request.workflowType !== 'alert') {
        throw new BadRequest('Invalid workflow type. Must be "case" or "alert"')
      }
      const type = request.workflowType as 'case' | 'alert'
      const statuses = await workflowService.getUniqueStatuses(type)
      return { statuses }
    })

    return await handlers.handle(event)
  }
)
