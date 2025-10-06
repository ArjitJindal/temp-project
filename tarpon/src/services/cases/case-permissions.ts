import { Forbidden } from 'http-errors'
import { PermissionStatements } from '@/@types/openapi-internal/PermissionStatements'
import { CaseService } from '@/services/cases'
import { CaseStatus } from '@/@types/openapi-internal/CaseStatus'
import {
  assertAccessForValue,
  getAllowedValues,
} from '@/services/rbac/utils/entity-permissions'

export const assertCaseStatusAccess = (
  statements: PermissionStatements[],
  caseStatus?: string
) => {
  assertAccessForValue(statements, caseStatus, {
    permissionId: 'case-status',
    param: 'filterCaseStatus',
    label: 'case status',
  })
}

export const assertCaseStatusAccessById = async (
  statements: PermissionStatements[],
  caseService: CaseService,
  caseId: string
) => {
  // Lean fetch through repository for status only
  const statusOnly = await caseService.caseRepository.getCaseStatusById(caseId)
  assertCaseStatusAccess(statements, statusOnly?.caseStatus as any)
}

export const enforceCaseStatusAccessAndGetCase = async (
  statements: PermissionStatements[],
  caseService: CaseService,
  caseId: string,
  options?: { logAuditLogView?: boolean }
) => {
  const statusOnly = await caseService.caseRepository.getCaseStatusById(caseId)
  assertCaseStatusAccess(statements, statusOnly?.caseStatus as any)
  // Fetch full entity only after access check
  const resp = await caseService.getCase(caseId, {
    logAuditLogView: options?.logAuditLogView ?? true,
  })
  return resp.result
}

/**
 * Enforces case status permissions for the case list endpoint
 *
 * Rules:
 * 1. Users must have case-management permissions to view cases
 * 2. Users with case-management permissions must also have case-status permissions
 * 3. Users with case-status permissions can only see cases with those statuses
 *
 * @throws {Forbidden} If the user doesn't have the required permissions
 */
export const enforceCaseListPermissions = (
  statements: PermissionStatements[],
  request: { filterCaseStatus?: CaseStatus[] }
): { filterCaseStatus?: CaseStatus[] } => {
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

  // Check if user has case-status path permission
  const caseStatusResources = allResources.filter((resource) =>
    resource.includes('case-management/case-status')
  )
  const hasCaseStatusPermission = caseStatusResources.length > 0

  // Get allowed case statuses from permissions
  const allowedCaseStatuses = getAllowedValues(statements, {
    permissionId: 'case-status',
    param: 'filterCaseStatus',
  })

  // Enforce permissions
  if (hasCaseManagementPermission) {
    if (hasCaseStatusPermission) {
      // If no filter provided, set it to all allowed statuses (if any)
      if (
        !modifiedRequest.filterCaseStatus ||
        modifiedRequest.filterCaseStatus.length === 0
      ) {
        if (allowedCaseStatuses.size > 0) {
          modifiedRequest.filterCaseStatus = Array.from(
            allowedCaseStatuses
          ) as CaseStatus[]
        } else {
          // User has case-status permission but no allowed values, deny access to all
          throw new Forbidden(
            'You have case status permissions but no allowed statuses'
          )
        }
      } else {
        // If filter provided, validate each status
        modifiedRequest.filterCaseStatus.forEach((status) =>
          assertCaseStatusAccess(statements, status)
        )
      }
    } else {
      // User has case management permissions but no status permissions
      throw new Forbidden('You need case status permissions to view cases')
    }
  } else {
    // User has no case management permissions at all
    throw new Forbidden('You do not have permission to view cases')
  }

  return modifiedRequest
}

/**
 * Filters case IDs to only include those the user has permission to access.
 * Instead of throwing 403 for any unauthorized case, this function returns
 * only the case IDs that the user is authorized to view.
 */
export const filterCaseIdsByPermission = async (
  statements: PermissionStatements[],
  caseService: CaseService,
  caseIds: string[]
): Promise<string[]> => {
  const authorizedCaseIds: string[] = []

  for (const caseId of caseIds) {
    try {
      // Check case status permission - filter out if unauthorized (no 403)
      await assertCaseStatusAccessById(statements, caseService, caseId)
      authorizedCaseIds.push(caseId)
    } catch (error) {
      // Skip this case if any error occurs during permission check
      continue
    }
  }

  return authorizedCaseIds
}
