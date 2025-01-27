import {
  AuditLog,
  AuditLogSubtypeEnum,
} from '@/@types/openapi-internal/AuditLog'
import { AuditLogActionEnum } from '@/@types/openapi-internal/AuditLogActionEnum'
import { AuditLogType } from '@/@types/openapi-internal/AuditLogType'
import { getContext } from '@/core/utils/context'
import { publishAuditLog } from '@/services/audit-log'

export type AuditLogReturnData<
  R,
  O extends object = object,
  N extends object = object
> = {
  oldImage?: O
  newImage?: N
  result: R
  entityId: string
  logMetadata?: object
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
        const result = await originalMethod.apply(this, args)

        const auditLog: AuditLog = {
          type,
          subtype,
          action,
          timestamp: Date.now(),
          oldImage: result.oldImage,
          newImage: result.newImage,
          entityId: result.entityId,
          logMetadata: result.logMetadata,
        }

        await publishAuditLog(getContext()?.tenantId as string, auditLog)

        // Return the result (the original return value)
        return result
      }
    }

    return descriptor
  }
}
