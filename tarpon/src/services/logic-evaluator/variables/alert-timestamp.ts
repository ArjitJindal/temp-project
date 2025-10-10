import { CommonUserLogicVariable } from './types'
import { User } from '@/@types/openapi-internal/User'
import { Business } from '@/@types/openapi-internal/Business'
import { AlertsRepository } from '@/services/alerts/repository'
import { getMongoDbClient } from '@/utils/mongodb-utils'

export const ALERT_TIMESTAMP: CommonUserLogicVariable<number | undefined> = {
  key: 'alertTimestamp',
  entity: 'USER',
  uiDefinition: {
    label: 'Last alert timestamp (from alert created date)',
    preferWidgets: ['time'],
    type: 'datetime',
  },
  valueType: 'number',
  load: async (
    user: User | Business,
    context?: { tenantId: string; dynamoDb: any }
  ) => {
    if (!context?.tenantId || !context?.dynamoDb) {
      return undefined
    }

    try {
      const userId = user.userId
      if (!userId) {
        return undefined
      }

      const alertsRepository = new AlertsRepository(context.tenantId, {
        mongoDb: await getMongoDbClient(),
        dynamoDb: context.dynamoDb,
      })

      // Use optimized method to get only the latest alert timestamp
      const latestTimestamp =
        await alertsRepository.getLatestAlertTimestampForUser(userId)

      return latestTimestamp || undefined
    } catch (error) {
      // Log error but don't fail the rule evaluation
      console.error('Error fetching alert timestamp:', error)
      return undefined
    }
  },
}
