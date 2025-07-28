import { migrateAllTenants } from '../utils/tenant'
import { Tenant } from '@/services/accounts/repository'
import { WorkflowService } from '@/services/workflow'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import { RiskLevelApprovalWorkflow } from '@/@types/openapi-internal/RiskLevelApprovalWorkflow'
import { FLAGRIGHT_SYSTEM_USER } from '@/utils/user'

async function migrateTenant(tenant: Tenant) {
  const dynamoDb = getDynamoDbClient()
  const mongoDb = await getMongoDbClient()

  const workflowService = new WorkflowService(tenant.id, { dynamoDb, mongoDb })

  // Check if default workflow already exists
  try {
    await workflowService.getWorkflow('risk-levels-approval', '_default')
    console.log(
      `Default risk-levels-approval workflow already exists for tenant ${tenant.id}`
    )
    return
  } catch (error) {
    // Workflow doesn't exist, create it
    console.log(
      `Creating default risk-levels-approval workflow for tenant ${tenant.id}`
    )
  }

  // Create default risk-levels-approval workflow
  const defaultWorkflow: RiskLevelApprovalWorkflow = {
    id: '_default',
    workflowType: 'risk-levels-approval',
    version: new Date('2025-07-18T00:00:00.000Z').getTime(),
    name: 'Default Risk Levels Approval Workflow',
    description: 'Default workflow for approving risk level changes',
    author: FLAGRIGHT_SYSTEM_USER,
    enabled: true,
    approvalChain: ['reviewer'],
  }

  await workflowService.saveWorkflow(
    'risk-levels-approval',
    '_default',
    defaultWorkflow
  )
  console.log(
    `Created default risk-levels-approval workflow for tenant ${tenant.id}`
  )
}

export const up = async () => {
  await migrateAllTenants(migrateTenant)
}
export const down = async () => {
  // skip
}
