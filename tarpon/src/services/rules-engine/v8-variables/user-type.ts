import { isBusinessUser } from '../utils/user-rule-utils'
import { CommonUserRuleVariable } from './types'
import { Business } from '@/@types/openapi-public/Business'
import { User } from '@/@types/openapi-public/User'

export const USER_TYPE: CommonUserRuleVariable = {
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
