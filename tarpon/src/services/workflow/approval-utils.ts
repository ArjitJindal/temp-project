import { Workflow } from './index'
import { RoleService } from '@/services/roles'
import { AccountsService } from '@/services/accounts'
import { RiskLevelApprovalWorkflow } from '@/@types/openapi-internal/RiskLevelApprovalWorkflow'
import { RiskFactorsApprovalWorkflow } from '@/@types/openapi-internal/RiskFactorsApprovalWorkflow'
import { UserUpdateApprovalWorkflow } from '@/@types/openapi-internal/UserUpdateApprovalWorkflow'

type ApprovalWorkflow =
  | RiskLevelApprovalWorkflow
  | RiskFactorsApprovalWorkflow
  | UserUpdateApprovalWorkflow

interface AutoSkipResult {
  shouldSkip: boolean
  startingStep: number
  isAutoApproved: boolean
}

/**
 * Type guard to check if a workflow is an approval workflow
 */
function isApprovalWorkflow(workflow: Workflow): workflow is ApprovalWorkflow {
  return (
    'approvalChain' in workflow &&
    Array.isArray((workflow as any).approvalChain)
  )
}

/**
 * Determines if the proposer should skip the first approval step
 * @param proposerId - The ID of the user who proposed the change (createdBy)
 * @param workflow - The workflow being used (could be approval or non-approval)
 * @param tenantId - The tenant ID
 * @param dynamoDb - DynamoDB client for role service
 * @returns AutoSkipResult indicating whether to skip and what starting step to use
 */
export async function shouldSkipFirstApprovalStep(
  proposerId: string,
  workflow: Workflow,
  tenantId: string,
  dynamoDb: any
): Promise<AutoSkipResult> {
  // If this is not an approval workflow, don't skip
  if (!isApprovalWorkflow(workflow)) {
    throw new Error('Workflow is not an approval workflow')
  }

  // If there's no approval chain or it's empty, don't skip
  if (!workflow.approvalChain || workflow.approvalChain.length === 0) {
    return { shouldSkip: false, startingStep: 0, isAutoApproved: false }
  }

  try {
    // Get the first approver role from the approval chain
    const firstApproverRole = workflow.approvalChain[0]

    // Get tenant information needed for role service
    const accountsService = AccountsService.getInstance(dynamoDb)
    const tenant = await accountsService.getTenantById(tenantId)

    if (!tenant) {
      console.log(`Tenant ${tenantId} not found, skipping auto-skip logic`)
      return { shouldSkip: false, startingStep: 0, isAutoApproved: false }
    }

    // Get role service and check if proposer has the first approver role
    const roleService = RoleService.getInstance(dynamoDb)
    const usersWithFirstApproverRole = await roleService.getUsersByRoleName(
      firstApproverRole,
      tenant
    )

    // Check if the proposer is in the list of users with the first approver role
    const proposerHasFirstApproverRole = usersWithFirstApproverRole.some(
      (user) => user.id === proposerId
    )

    if (!proposerHasFirstApproverRole) {
      // Proposer doesn't have the first approver role, proceed normally
      return { shouldSkip: false, startingStep: 0, isAutoApproved: false }
    }

    // Proposer has the first approver role
    if (workflow.approvalChain.length === 1) {
      // Single step workflow - auto-approve
      console.log(
        `Auto-approving single-step workflow for proposer ${proposerId} with role ${firstApproverRole}`
      )
      return { shouldSkip: true, startingStep: 0, isAutoApproved: true }
    } else {
      // Multi-step workflow - skip to step 1
      console.log(
        `Skipping first approval step for proposer ${proposerId} with role ${firstApproverRole}, starting at step 1`
      )
      return { shouldSkip: true, startingStep: 1, isAutoApproved: false }
    }
  } catch (error) {
    console.error('Error in shouldSkipFirstApprovalStep:', error)
    // On error, proceed with normal approval flow
    return { shouldSkip: false, startingStep: 0, isAutoApproved: false }
  }
}
