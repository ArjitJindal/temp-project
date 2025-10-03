import { migrateAllTenants } from '../utils/tenant'
import { Tenant } from '@/services/accounts/repository'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { RoleService } from '@/services/roles'
import { PermissionStatements } from '@/@types/openapi-internal/PermissionStatements'
import { FilterCondition } from '@/@types/openapi-internal/FilterCondition'
import { isDemoTenant } from '@/utils/tenant-id'

const STATUS_RESOURCES = [
  'frn:console:<default>:::case-management/case-status/*',
  'frn:console:<default>:::case-management/alert-status/*',
]

const STATUS_FILTERS: FilterCondition[] = [
  {
    permissionId: 'case-status',
    operator: 'Equals',
    param: 'filterCaseStatus',
    values: [
      'OPEN',
      'CLOSED',
      'REOPENED',
      'ESCALATED',
      'IN_REVIEW_OPEN',
      'IN_REVIEW_ESCALATED',
      'IN_REVIEW_CLOSED',
      'IN_REVIEW_REOPENED',
      'OPEN_IN_PROGRESS',
      'ESCALATED_IN_PROGRESS',
      'OPEN_ON_HOLD',
      'ESCALATED_ON_HOLD',
      'ESCALATED_L2',
    ],
  },
  {
    permissionId: 'alert-status',
    operator: 'Equals',
    param: 'filterAlertStatus',
    values: [
      'OPEN',
      'CLOSED',
      'REOPENED',
      'ESCALATED',
      'IN_REVIEW_OPEN',
      'IN_REVIEW_ESCALATED',
      'IN_REVIEW_CLOSED',
      'IN_REVIEW_REOPENED',
      'OPEN_IN_PROGRESS',
      'ESCALATED_IN_PROGRESS',
      'OPEN_ON_HOLD',
      'ESCALATED_ON_HOLD',
      'ESCALATED_L2',
    ],
  },
]

function hasStatusResources(st: PermissionStatements): boolean {
  return STATUS_RESOURCES.every((r) => st.resources.includes(r))
}

function mergeStatusIntoStatement(
  st: PermissionStatements
): PermissionStatements {
  const mergedResources = Array.from(
    new Set([...st.resources, ...STATUS_RESOURCES])
  )
  const existingFilters = Array.isArray(st.filter) ? st.filter : []

  // merge filters by permissionId
  const byId = new Map<
    string,
    {
      param: string
      operator: FilterCondition['operator']
      values: Set<string>
    }
  >()
  for (const f of existingFilters) {
    byId.set(f.permissionId, {
      param: f.param,
      operator: f.operator,
      values: new Set(f.values || []),
    })
  }
  for (const f of STATUS_FILTERS) {
    const existing = byId.get(f.permissionId)
    if (!existing) {
      byId.set(f.permissionId, {
        param: f.param,
        operator: f.operator,
        values: new Set(f.values),
      })
    } else {
      f.values.forEach((v) => existing.values.add(v))
    }
  }
  const mergedFilters: FilterCondition[] = Array.from(byId.entries()).map(
    ([permissionId, v]) => ({
      permissionId,
      param: v.param,
      operator: v.operator,
      values: Array.from(v.values),
    })
  )

  return { ...st, resources: mergedResources, filter: mergedFilters }
}

async function migrateTenant(tenant: Tenant, auth0Domain: string) {
  if (isDemoTenant(tenant.id)) {
    return
  }
  const dynamoDb = await getDynamoDbClient()
  const roleService = RoleService.getInstance(dynamoDb, auth0Domain)

  const roles = await roleService.getTenantRoles(tenant.id)
  const defaultRoleNames = new Set([
    'root',
    'whitelabel-root',
    'admin',
    'auditor',
    'analyst',
    'approver',
    'developer',
  ])

  for (const role of roles) {
    // Skip all managed/default roles; only process custom roles
    if (!role.name || defaultRoleNames.has(role.name)) {
      continue
    }

    const statements = role.statements ?? []

    // Find a read-only statement we can append to; otherwise create one.
    const readStmtIndex = statements.findIndex(
      (s) => s.actions.length === 1 && s.actions[0] === 'read'
    )

    let updatedStatements: PermissionStatements[]
    if (readStmtIndex >= 0) {
      const target = statements[readStmtIndex]
      const withStatus = hasStatusResources(target)
        ? target
        : mergeStatusIntoStatement(target)
      updatedStatements = [...statements]
      updatedStatements[readStmtIndex] = withStatus
    } else {
      updatedStatements = [
        ...statements,
        {
          actions: ['read'],
          resources: STATUS_RESOURCES,
          filter: STATUS_FILTERS as any,
        },
      ]
    }

    await roleService.updateRole(tenant.id, role.id, {
      ...role,
      statements: updatedStatements,
    })
  }
}

export const up = async () => {
  await migrateAllTenants(migrateTenant)
}
export const down = async () => {
  // skip
}
