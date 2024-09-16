import { LogicVariableContext } from '../types'
import { USER_CHILD_USER_IDS } from '../user-child-user-ids'
import { dynamoDbSetupHook } from '@/test-utils/dynamodb-test-utils'
import { getTestTenantId } from '@/test-utils/tenant-test-utils'
import { createConsumerUsers, getTestUser } from '@/test-utils/user-test-utils'

dynamoDbSetupHook()

test('User child user IDs', async () => {
  const tenantId = getTestTenantId()
  const user = getTestUser({})
  await createConsumerUsers(tenantId, [
    getTestUser({
      userId: 'child-user-1',
      linkedEntities: { parentUserId: user.userId },
    }),
    getTestUser({
      userId: 'child-user-2',
      linkedEntities: { parentUserId: user.userId },
    }),
    getTestUser({
      userId: 'child-user-3',
      linkedEntities: { parentUserId: 'abc' },
    }),
  ])
  const childUserIds = await USER_CHILD_USER_IDS.load(user, {
    tenantId,
  } as LogicVariableContext)
  expect(childUserIds).toEqual(['child-user-1', 'child-user-2'])
})
