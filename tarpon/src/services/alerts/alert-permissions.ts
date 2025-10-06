import { Forbidden } from 'http-errors'
import { PermissionStatements } from '@/@types/openapi-internal/PermissionStatements'
import { AlertsService } from '@/services/alerts'
import { CaseService } from '@/services/cases'
import { AlertStatus } from '@/@types/openapi-internal/AlertStatus'
import { assertCaseStatusAccessById } from '@/services/cases/case-permissions'
import {
  getAllowedValues,
  assertAccessForValue,
} from '@/services/rbac/utils/entity-permissions'

export const assertAlertAndCaseAccessByAlertId = async (
  statements: PermissionStatements[],
  caseService: CaseService,
  alertsService: AlertsService,
  alertId: string,
  _options?: { auditLog?: boolean }
) => {
  // Lean fetch: only alertId, caseId, status
  const lean = await alertsService.alertsRepository.getAlertLeanById(alertId)
  if (!lean) {
    return
  }
  if (lean.status) {
    assertAccessForValue(statements, lean.status, {
      permissionId: 'alert-status',
      param: 'filterAlertStatus',
      label: 'alert status',
    })
  }
  if (lean.caseId) {
    await assertCaseStatusAccessById(statements, caseService, lean.caseId)
  }
}

/**
 * Filters alert IDs to only include those the user has permission to access.
 * Case permissions are checked first and will throw 403 if unauthorized.
 * Alert status permissions are filtered out (no 403 thrown).
 */
export const filterAlertIdsByPermission = async (
  statements: PermissionStatements[],
  caseService: CaseService,
  alertsService: AlertsService,
  alertIds: string[]
): Promise<string[]> => {
  const authorizedAlertIds: string[] = []

  for (const alertId of alertIds) {
    // Lean fetch: only alertId, caseId, status
    const lean = await alertsService.alertsRepository.getAlertLeanById(alertId)
    if (!lean) {
      continue // Skip if alert doesn't exist
    }

    // Check case status permission first - throw 403 if unauthorized
    if (lean.caseId) {
      await assertCaseStatusAccessById(statements, caseService, lean.caseId)
    }

    // Check alert status permission - filter out if unauthorized (no 403)
    let hasAlertPermission = true
    if (lean.status) {
      try {
        assertAccessForValue(statements, lean.status, {
          permissionId: 'alert-status',
          param: 'filterAlertStatus',
          label: 'alert status',
        })
      } catch (error) {
        hasAlertPermission = false
      }
    }

    if (hasAlertPermission) {
      authorizedAlertIds.push(alertId)
    }
  }

  return authorizedAlertIds
}

export const enforceAlertAccessAndGetAlert = async (
  statements: PermissionStatements[],
  caseService: CaseService,
  alertsService: AlertsService,
  alertId: string,
  _options?: { auditLog?: boolean }
) => {
  const lean = await alertsService.alertsRepository.getAlertLeanById(alertId)
  if (lean) {
    if (lean.status) {
      assertAccessForValue(statements, lean.status, {
        permissionId: 'alert-status',
        param: 'filterAlertStatus',
        label: 'alert status',
      })
    }
    if (lean.caseId) {
      await assertCaseStatusAccessById(statements, caseService, lean.caseId)
    }
  }

  // Fetch full entity only after access check
  return (
    await alertsService.getAlert(alertId, {
      auditLog: _options?.auditLog ?? true,
    })
  ).result as any
}

/**
 * Enforces alert status permissions for the alert list endpoint
 *
 * Rules:
 * 1. Users must have case-management permissions to view alerts
 * 2. Users with case-management permissions must also have alert-status permissions
 * 3. Users with alert-status permissions can only see alerts with those statuses
 *
 * @throws {Forbidden} If the user doesn't have the required permissions
 */
export const enforceAlertListPermissions = (
  statements: PermissionStatements[],
  request: { filterAlertStatus?: AlertStatus[] }
): { filterAlertStatus?: AlertStatus[] } => {
  // Create a copy of the request to avoid modifying the original
  const modifiedRequest = { ...request }

  // Check for admin access (wildcard tenant ID)
  const hasAdminAccess = statements.some((s) =>
    s.resources.some((r) => r === 'frn:console:*:::*')
  )

  // If user has admin access, they can see everything without restrictions
  if (hasAdminAccess) {
    return modifiedRequest
  }

  // Check if user has any case-management permissions
  const allResources = statements.flatMap((s) => s.resources)
  const hasCaseManagementPermission = allResources.some((resource) =>
    resource.includes('case-management/')
  )

  // Check if user has alert-status path permission
  const alertStatusResources = allResources.filter((resource) =>
    resource.includes('case-management/alert-status')
  )
  const hasAlertStatusPermission = alertStatusResources.length > 0

  // Get allowed alert statuses from permissions
  const allowedAlertStatuses = getAllowedValues(statements, {
    permissionId: 'alert-status',
    param: 'filterAlertStatus',
  })

  // Enforce permissions
  if (hasCaseManagementPermission) {
    if (hasAlertStatusPermission) {
      // If no filter provided, set it to all allowed statuses (if any)
      if (
        !modifiedRequest.filterAlertStatus ||
        modifiedRequest.filterAlertStatus.length === 0
      ) {
        if (allowedAlertStatuses.size > 0) {
          modifiedRequest.filterAlertStatus = Array.from(
            allowedAlertStatuses
          ) as AlertStatus[]
        } else {
          // User has alert-status permission but no allowed values, deny access to all
          throw new Forbidden(
            'You have alert status permissions but no allowed statuses'
          )
        }
      } else {
        // If filter provided, validate each status
        modifiedRequest.filterAlertStatus.forEach((status) =>
          assertAccessForValue(statements, status, {
            permissionId: 'alert-status',
            param: 'filterAlertStatus',
            label: 'alert status',
          })
        )
      }
    } else {
      // User has case management permissions but no status permissions
      throw new Forbidden('You need alert status permissions to view alerts')
    }
  } else {
    // User has no case management permissions at all
    throw new Forbidden('You do not have permission to view alerts')
  }

  return modifiedRequest
}
