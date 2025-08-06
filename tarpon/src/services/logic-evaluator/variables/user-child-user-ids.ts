import { CommonUserLogicVariable } from './types'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import { Business } from '@/@types/openapi-public/Business'
import { User } from '@/@types/openapi-public/User'
import { UserRepository } from '@/services/users/repositories/user-repository'
import { UserClickhouseRepository } from '@/services/users/repositories/user-clickhouse-repository'
import {
  getClickhouseClient,
  isClickhouseEnabled,
} from '@/utils/clickhouse/utils'

export const USER_CHILD_USER_IDS: CommonUserLogicVariable = {
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
    if (isClickhouseEnabled()) {
      const clickhouseClient = await getClickhouseClient(context.tenantId)
      const clickhouseUserRepository = new UserClickhouseRepository(
        context.tenantId,
        clickhouseClient,
        context.dynamoDb
      )
      return await clickhouseUserRepository.getChildUserIds(user.userId)
    }
    return await userRepo.getChildUserIds(user.userId)
  },
}
