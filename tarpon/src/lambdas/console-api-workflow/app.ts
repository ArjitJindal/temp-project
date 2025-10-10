import {
  APIGatewayEventLambdaAuthorizerContext,
  APIGatewayProxyWithLambdaAuthorizerEvent,
} from 'aws-lambda'
import { BadRequest } from 'http-errors'
import {
  CaseWorkflowMachine,
  AlertWorkflowMachine,
  RiskLevelApprovalWorkflowMachine,
  RiskFactorsApprovalWorkflowMachine,
  UserUpdateApprovalWorkflowMachine,
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
import { RiskFactorsApprovalWorkflow } from '@/@types/openapi-internal/RiskFactorsApprovalWorkflow'
import { UserUpdateApprovalWorkflow } from '@/@types/openapi-internal/UserUpdateApprovalWorkflow'
import { WorkflowType } from '@/@types/openapi-internal/WorkflowType'

type GenericWorkflow =
  | CaseWorkflow
  | AlertWorkflow
  | RiskLevelApprovalWorkflow
  | RiskFactorsApprovalWorkflow
  | UserUpdateApprovalWorkflow

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
  } else if (request.workflowType === 'risk-factors-approval') {
    workflow =
      inlineObject.riskFactorsApprovalWorkflow as RiskFactorsApprovalWorkflow
    try {
      RiskFactorsApprovalWorkflowMachine.validate(workflow)
    } catch (error) {
      throw new BadRequest(
        'Invalid workflow definition: ' + (error as Error).message
      )
    }
  } else if (request.workflowType === 'user-update-approval') {
    workflow =
      inlineObject.userUpdateApprovalWorkflow as UserUpdateApprovalWorkflow
    try {
      UserUpdateApprovalWorkflowMachine.validate(workflow)
    } catch (error) {
      throw new BadRequest(
        'Invalid workflow definition: ' + (error as Error).message
      )
    }
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

    // TODO: fix the return types of the handlers

    // Get all workflows
    handlers.registerGetAllWorkflows(async (_ctx, request) => {
      const type = request.workflowType as WorkflowType
      return (await workflowService.getWorkflows(type)) as any
    })

    // Get workflow by ID
    handlers.registerGetWorkflowById(async (_ctx, request) => {
      return (await workflowService.getWorkflow(
        request.workflowType as WorkflowType,
        request.workflowId
      )) as any
    })

    handlers.registerCreateWorkflow(async (_ctx, request) => {
      const workflow = parseWorkflow(request)
      return (await workflowService.saveWorkflow(
        request.workflowType as WorkflowType,
        undefined,
        workflow
      )) as any
    })

    handlers.registerPostWorkflowVersion(async (_ctx, request) => {
      const workflow = parseWorkflow(request)
      const result = await workflowService.saveWorkflow(
        request.workflowType as WorkflowType,
        request.workflowId,
        workflow
      )

      // TODO: when enabling workflow builder and storing a reference to the workflow
      // in the tenant config, we can remove this call and move it to the tenant conf POST route
      const updateCount =
        await workflowService.updatePendingApprovalsForWorkflow(
          request.workflowType as WorkflowType,
          { id: result.id, version: result.version }
        )
      if (updateCount > 0) {
        console.log(
          `Updated ${updateCount} pending approvals after workflow update`
        )
      }
      return result as any
    })

    // Get specific version of workflow
    handlers.registerGetWorkflowVersion(async (_ctx, request) => {
      return (await workflowService.getWorkflowVersion(
        request.workflowType as WorkflowType,
        request.workflowId,
        request.version
      )) as any
    })

    // Get workflow history
    handlers.registerGetWorkflowHistory(async (_ctx, request) => {
      return (await workflowService.getWorkflowHistory(
        request.workflowType as WorkflowType,
        request.workflowId
      )) as any
    })

    // Get all workflows of all types
    handlers.registerGetAllWorkflowTypes(async (_ctx, request) => {
      const workflows = await workflowService.getWorkflows(request.type)
      return { workflows } as any
    })

    handlers.registerGetWorkflowVersionsBulk(async (_ctx, request) => {
      const requestedWorkflows =
        request.GetWorkflowVersionsBulkRequest.workflows
      const workflowPromises = requestedWorkflows.map(async (item) => {
        try {
          return (await workflowService.getWorkflowVersion(
            item.type,
            item.id,
            item.version
          )) as any
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
