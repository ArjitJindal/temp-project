import { CommonUserRuleVariable } from './types'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import { Business } from '@/@types/openapi-public/Business'
import { User } from '@/@types/openapi-public/User'
import { UserRepository } from '@/services/users/repositories/user-repository'

export const USER_CHILD_USER_IDS: CommonUserRuleVariable = {
  key: 'childUserIds',
  entity: 'USER',
  valueType: 'string',
  uiDefinition: {
    label: 'child user IDs',
    type: 'multiselect',
    valueSources: ['value', 'field', 'func'],
  },
  load: async (user: User | Business, context) => {
    if (!context) {
      throw new Error('Missing context')
    }
    const mongoDb = await getMongoDbClient()
    const userRepo = new UserRepository(context.tenantId, { mongoDb })
    return await userRepo.getChildUserIds(user.userId)
  },
}
