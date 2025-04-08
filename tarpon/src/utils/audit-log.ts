import { Alert } from '@/@types/openapi-internal/Alert'
import {
  AuditLog,
  AuditLogSubtypeEnum,
} from '@/@types/openapi-internal/AuditLog'
import { AuditLogActionEnum } from '@/@types/openapi-internal/AuditLogActionEnum'
import { AuditLogType } from '@/@types/openapi-internal/AuditLogType'
import { Case } from '@/@types/openapi-internal/Case'
import { Report } from '@/@types/openapi-internal/Report'
import { getContext } from '@/core/utils/context-storage'
import { publishAuditLog } from '@/services/audit-log'

export type AuditLogEntity<
  O extends object = object,
  N extends object = object
> = {
  entityId: string
  oldImage?: O
  newImage?: N
  logMetadata?: object
  entityType?: AuditLogType
  entitySubtype?: AuditLogSubtypeEnum
  entityAction?: AuditLogActionEnum
}

export type AuditLogReturnData<
  R,
  O extends object = object,
  N extends object = object
> = {
  entities: AuditLogEntity<O, N>[]
  result: R
  publishAuditLog?: () => boolean
  actionTypeOverride?: AuditLogActionEnum
}

export function auditLog<
  T extends (...args: any[]) => Promise<AuditLogReturnData<any>>
>(
  type: AuditLogType,
  subtype: AuditLogSubtypeEnum,
  action: AuditLogActionEnum
) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: TypedPropertyDescriptor<T>
  ) {
    const originalMethod = descriptor.value

    // Ensure the original method exists and is an async function
    if (originalMethod) {
      // Modify the original async method
      ;(descriptor as any).value = async function (...args: any[]) {
        // Call the original async method and await the result
        const parameter = await originalMethod.apply(this, args)

        if (!parameter.publishAuditLog || parameter.publishAuditLog()) {
          await Promise.all(
            parameter.entities.map((entity) => {
              const auditLog: AuditLog = {
                type: entity.entityType ?? type,
                subtype: entity.entitySubtype ?? subtype,
                action:
                  entity.entityAction ?? parameter.actionTypeOverride ?? action,
                timestamp: Date.now(),
                oldImage: entity.oldImage,
                newImage: entity.newImage,
                entityId: entity.entityId,
                logMetadata: entity.logMetadata,
              }
              return publishAuditLog(getContext()?.tenantId as string, auditLog)
            })
          )
        }
        // Return the result (the original return value)
        return parameter
      }
    }

    return descriptor
  }
}

export function getAlertAuditLogMetadata(
  alertEntity: Alert | undefined | null
) {
  return {
    alertAssignment: alertEntity?.assignments,
    alertCreationTimestamp: alertEntity?.createdTimestamp,
    alertPriority: alertEntity?.priority,
    alertStatus: alertEntity?.alertStatus,
    caseId: alertEntity?.caseId,
  }
}

export function getCaseAuditLogMetadata(caseEntity: Case | undefined | null) {
  return {
    caseAssignment: caseEntity?.assignments ?? [],
    caseCreationTimestamp: caseEntity?.createdTimestamp,
    casePriority: caseEntity?.priority,
    caseStatus: caseEntity?.caseStatus,
    reviewAssignments: caseEntity?.reviewAssignments ?? [],
  }
}

export function getReportAuditLogMetadata(
  reportEntity: Report | undefined | null
) {
  return {
    name: reportEntity?.name,
    description: reportEntity?.description,
    caseId: reportEntity?.caseId,
    reportTypeId: reportEntity?.reportTypeId,
    caseUserId: reportEntity?.caseUserId,
    createdById: reportEntity?.createdById,
    parameters: reportEntity?.parameters,
    comments: reportEntity?.comments,
    revisions: reportEntity?.revisions,
    attachments: reportEntity?.attachments,
    caseUser: reportEntity?.caseUser,
    sarCreationTimestamp: reportEntity?.createdAt,
  }
}
