import { AlertLogMetaDataType, UserLogMetaDataType } from '@/@types/audit-log'

export const getEntityMetadata = (
  entityType: 'USER' | 'ALERT' | 'CASE',
  logMetadata?: AlertLogMetaDataType | UserLogMetaDataType
) => {
  switch (entityType) {
    case 'USER':
      return {
        user: {
          userType: (logMetadata as UserLogMetaDataType)?.userType,
        },
      }
    case 'ALERT':
      return {
        alert: {
          caseId: (logMetadata as AlertLogMetaDataType)?.caseId,
        },
      }
    case 'CASE':
      return {}
  }
}
