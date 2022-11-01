import UserTypeRuleFilter from '../user-type'
import { getTestTenantId } from '@/test-utils/tenant-test-utils'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { getTestUser } from '@/test-utils/user-test-utils'

const dynamodb = getDynamoDbClient()

test('User matches the target user type', async () => {
  expect(
    await new UserTypeRuleFilter(
      getTestTenantId(),
      {
        user: getTestUser(),
      },
      { userType: 'CONSUMER' },
      dynamodb
    ).predicate()
  ).toBe(true)
})

test("User doesn't match the target user type", async () => {
  expect(
    await new UserTypeRuleFilter(
      getTestTenantId(),
      {
        user: getTestUser(),
      },
      { userType: 'BUSINESS' },
      dynamodb
    ).predicate()
  ).toBe(false)
})
