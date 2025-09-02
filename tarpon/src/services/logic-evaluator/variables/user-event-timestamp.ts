import { CommonUserLogicVariable } from './types'
import { User } from '@/@types/openapi-internal/User'
import { Business } from '@/@types/openapi-internal/Business'
import { UserEventRepository } from '@/services/rules-engine/repositories/user-event-repository'
import { isBusinessUser } from '@/services/rules-engine/utils/user-rule-utils'

export const USER_EVENT_TIMESTAMP: CommonUserLogicVariable<number | undefined> =
  {
    key: 'userEventTimestamp',
    entity: 'USER',
    uiDefinition: {
      label: 'Last user event timestamp (from user event created date)',
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

        // Use optimized method to get only the latest user event timestamp
        const userEventRepository = new UserEventRepository(context.tenantId, {
          dynamoDb: context.dynamoDb,
        })
        const latestTimestamp =
          await userEventRepository.getLatestUserEventTimestampForUser(
            userId,
            isBusinessUser(user) ? 'BUSINESS' : 'CONSUMER'
          )

        return latestTimestamp || undefined
      } catch (error) {
        // Log error but don't fail the rule evaluation
        console.error('Error fetching user event timestamp:', error)
        return undefined
      }
    },
  }
