import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb'
import { MongoClient } from 'mongodb'
import { some } from 'lodash'
import { migrateAllTenants } from '../utils/tenant'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { Tenant } from '@/services/accounts/repository'
import { getMongoDbClient, processCursorInBatch } from '@/utils/mongodb-utils'
import { RuleInstanceRepository } from '@/services/rules-engine/repositories/rule-instance-repository'
import { AlertsRepository } from '@/services/alerts/repository'
import { FLAGRIGHT_SYSTEM_USER } from '@/utils/user'
import { CASES_COLLECTION } from '@/utils/mongodb-definitions'
import { AccountsService } from '@/services/accounts'
import { Alert } from '@/@types/openapi-internal/Alert'
import { Assignment } from '@/@types/openapi-internal/Assignment'
import { RuleInstance } from '@/@types/openapi-internal/RuleInstance'
import { Auth0RolesRepository } from '@/services/roles/repository/auth0'

async function migrateTenant(tenant: Tenant, auth0Domain: string) {
  const tenantId = tenant.id
  const dynamoDb = getDynamoDbClient()
  const mongoDb = await getMongoDbClient()
  const accountsService = new AccountsService(
    { auth0Domain: auth0Domain },
    { dynamoDb }
  )
  const rolesRepository = new Auth0RolesRepository(auth0Domain)
  const tenantAccounts = await accountsService.getTenantAccounts(tenant)
  const tenantAccountIds = tenantAccounts.map((val) => val.id)
  if (!tenantAccounts || tenantAccounts.length == 0) {
    return
  }
  const ruleInstances = await getRuleInstancesWithAutoAssignment(
    tenantId,
    dynamoDb
  )
  if (!ruleInstances || ruleInstances.length == 0) {
    return
  }
  for (const instance of ruleInstances) {
    await fixAssignmentsForInstance(
      tenant,
      instance,
      mongoDb,
      tenantAccountIds,
      rolesRepository
    )
  }
  console.log(`Corrected all alert assignments for tenant: ${tenantId}`)
}

async function getRuleInstancesWithAutoAssignment(
  tenantId: string,
  dynamoDb: DynamoDBDocumentClient
) {
  const ruleInstanceRepository = new RuleInstanceRepository(tenantId, {
    dynamoDb,
  })
  const allInstances = await ruleInstanceRepository.getAllRuleInstances()
  const requiredInstances = allInstances.filter(
    (instance) => instance.alertConfig?.alertAssigneeRole != null
  )
  return requiredInstances as Array<
    RuleInstance & {
      alertConfig: {
        alertAssigneeRole: string
      }
    }
  >
}

async function fixAssignmentsForInstance(
  tenant: Tenant,
  ruleInstance: RuleInstance & {
    alertConfig: {
      alertAssigneeRole: string
    }
  },
  mongoDb: MongoClient,
  tenantAccountIds: string[],
  rolesRepository: Auth0RolesRepository
) {
  if (!ruleInstance.id) {
    return
  }
  const alertsCollection = mongoDb.db().collection(CASES_COLLECTION(tenant.id))
  const alertsRepository = new AlertsRepository(tenant.id, {
    mongoDb,
    dynamoDb: getDynamoDbClient(),
  })
  const condition = {
    $and: [{ 'alerts.ruleInstanceId': ruleInstance.id }],
  }
  const alertsCursor = alertsCollection.aggregate<Alert>([
    {
      $match: condition,
    },
    {
      $unwind: {
        path: '$alerts',
      },
    },
    {
      $match: condition,
    },
    {
      $set: {
        alert: '$alerts',
      },
    },
    {
      $project: {
        alert: 1,
      },
    },
  ])
  await processCursorInBatch(
    alertsCursor,
    async (alerts) => {
      await Promise.all(
        alerts.map(async (alert) => {
          await fixAlert(
            alert,
            tenantAccountIds,
            alertsRepository,
            ruleInstance.alertConfig?.alertAssigneeRole,
            rolesRepository,
            tenant
          )
        })
      )
      console.log(
        `Correctly assigned ${alerts.length} alerts for tenant ${tenant.id}`
      )
    },
    {
      mongoBatchSize: 500,
      processBatchSize: 50,
    }
  )
}
async function fixAlert(
  alert: Alert,
  tenantAccountIds: string[],
  alertsRepository: AlertsRepository,
  ruleAssignmentRole: string,
  rolesRepository: Auth0RolesRepository,
  tenant: Tenant
) {
  const isAffected = some(
    alert.assignments ?? [],
    (data: Assignment) => !tenantAccountIds.includes(data.assigneeUserId)
  )
  if (!isAffected || !alert.alertId) {
    return
  }
  if (alert.alertStatus === 'CLOSED' && alert.lastStatusChange?.userId) {
    await alertsRepository.updateAssignments(
      [alert.alertId],
      [
        {
          assignedByUserId: FLAGRIGHT_SYSTEM_USER,
          assigneeUserId: alert.lastStatusChange?.userId,
          timestamp: alert.updatedAt ?? Date.now(),
        },
      ]
    )
    return
  }
  const accounts = await rolesRepository.getUsersByRole(
    ruleAssignmentRole,
    tenant
  )
  const accountId =
    accounts.length > 0
      ? accounts[Math.floor(Math.random() * accounts.length)].id
      : undefined
  await alertsRepository.updateAssignments(
    [alert.alertId],
    accountId
      ? [
          {
            assignedByUserId: FLAGRIGHT_SYSTEM_USER,
            assigneeUserId: accountId,
            timestamp: alert.updatedAt ?? Date.now(),
          },
        ]
      : [] // Marking assignee as empty as we don't know which account to assign.
  )
}
export const up = async () => {
  await migrateAllTenants(migrateTenant)
}
export const down = async () => {
  // skip
}
