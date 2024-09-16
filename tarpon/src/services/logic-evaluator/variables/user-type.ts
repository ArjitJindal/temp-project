import { CommonUserLogicVariable } from './types'
import { Business } from '@/@types/openapi-public/Business'
import { User } from '@/@types/openapi-public/User'
import { isBusinessUser } from '@/services/rules-engine/utils/user-rule-utils'

export const USER_TYPE: CommonUserLogicVariable = {
  key: 'type',
  entity: 'USER',
  valueType: 'string',
  uiDefinition: {
    label: 'type',
    type: 'select',
    valueSources: ['value'],
    fieldSettings: {
      listValues: [
        { title: 'Consumer', value: 'CONSUMER' },
        { title: 'Business', value: 'BUSINESS' },
      ],
    },
  },
  load: async (user: User | Business) => {
    return isBusinessUser(user) ? 'BUSINESS' : 'CONSUMER'
  },
}
