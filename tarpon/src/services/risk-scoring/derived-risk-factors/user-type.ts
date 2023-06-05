import { UserRiskFactorValueHandler } from '.'
import {
  isBusinessUser,
  isConsumerUser,
} from '@/services/rules-engine/utils/user-rule-utils'

export const KRS_USER_TYPE_RISK_HANDLERS: Array<
  UserRiskFactorValueHandler<string | undefined | null>
> = [
  {
    entityType: 'CONSUMER_USER',
    parameter: 'type',
    handler: async (user, _) => {
      return isConsumerUser(user) ? ['CONSUMER'] : []
    },
  },
  {
    entityType: 'BUSINESS',
    parameter: 'type',
    handler: async (user, _) => {
      return isBusinessUser(user) ? ['BUSINESS'] : []
    },
  },
]
