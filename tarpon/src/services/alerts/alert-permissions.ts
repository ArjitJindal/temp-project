import { PermissionStatements } from '@/@types/openapi-internal/PermissionStatements'
import { AlertsService } from '@/services/alerts'
import { CaseService } from '@/services/cases'
import { assertCaseStatusAccessById } from '@/services/cases/case-permissions'
import {
  getAllowedValues,
  assertAccessForValue,
} from '@/services/rbac/utils/entity-permissions'

const needsAlertStatusCheck = (statements: PermissionStatements[]) =>
  getAllowedValues(statements, {
    permissionId: 'alert-status',
    param: 'filterAlertStatus',
  }).size > 0

const needsCaseStatusCheck = (statements: PermissionStatements[]) =>
  getAllowedValues(statements, {
    permissionId: 'case-status',
    param: 'filterCaseStatus',
  }).size > 0

export const assertAlertAndCaseAccessByAlertId = async (
  statements: PermissionStatements[],
  caseService: CaseService,
  alertsService: AlertsService,
  alertId: string,
  _options?: { auditLog?: boolean }
) => {
  const checkAlert = needsAlertStatusCheck(statements)
  const checkCase = needsCaseStatusCheck(statements)
  if (!checkAlert && !checkCase) {
    return
  }

  // Lean fetch: only alertId, caseId, status
  const lean = await alertsService.alertsRepository.getAlertLeanById(alertId)
  if (!lean) {
    return
  }

  if (checkAlert) {
    assertAccessForValue(statements, lean.status, {
      permissionId: 'alert-status',
      param: 'filterAlertStatus',
      label: 'alert status',
    })
  }

  if (checkCase && lean.caseId) {
    await assertCaseStatusAccessById(statements, caseService, lean.caseId)
  }
}

export const enforceAlertAccessAndGetAlert = async (
  statements: PermissionStatements[],
  caseService: CaseService,
  alertsService: AlertsService,
  alertId: string,
  _options?: { auditLog?: boolean }
) => {
  const checkAlert = needsAlertStatusCheck(statements)
  const checkCase = needsCaseStatusCheck(statements)

  if (checkAlert || checkCase) {
    const lean = await alertsService.alertsRepository.getAlertLeanById(alertId)
    if (lean) {
      if (checkAlert) {
        assertAccessForValue(statements, lean.status, {
          permissionId: 'alert-status',
          param: 'filterAlertStatus',
          label: 'alert status',
        })
      }
      if (checkCase && lean.caseId) {
        await assertCaseStatusAccessById(statements, caseService, lean.caseId)
      }
    }
  }

  // Fetch full entity only after access check
  return (
    await alertsService.getAlert(alertId, {
      auditLog: _options?.auditLog ?? true,
    })
  ).result as any
}
