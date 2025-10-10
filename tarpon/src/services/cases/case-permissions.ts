import { PermissionStatements } from '@/@types/openapi-internal/PermissionStatements'
import { CaseService } from '@/services/cases'
import {
  assertAccessForValue,
  getAllowedValues,
} from '@/services/rbac/utils/entity-permissions'

const needsCaseStatusCheck = (statements: PermissionStatements[]) =>
  getAllowedValues(statements, {
    permissionId: 'case-status',
    param: 'filterCaseStatus',
  }).size > 0

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
  if (!needsCaseStatusCheck(statements)) {
    return
  }
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
  if (needsCaseStatusCheck(statements)) {
    const statusOnly = await caseService.caseRepository.getCaseStatusById(
      caseId
    )
    assertCaseStatusAccess(statements, statusOnly?.caseStatus as any)
  }
  // Fetch full entity only after access check
  const resp = await caseService.getCase(caseId, {
    logAuditLogView: options?.logAuditLogView ?? true,
  })
  return resp.result
}
