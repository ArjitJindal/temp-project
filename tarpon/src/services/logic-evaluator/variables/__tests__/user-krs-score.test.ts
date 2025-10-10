import { USER_KRS_SCORE } from '../user-krs-score'
import { LogicVariableContext } from '../types'
import { createConsumerUser, getTestUser } from '@/test-utils/user-test-utils'
import { getTestTenantId } from '@/test-utils/tenant-test-utils'
import { withFeatureHook } from '@/test-utils/feature-test-utils'
import { dynamoDbSetupHook } from '@/test-utils/dynamodb-test-utils'
import { getDynamoDbClient } from '@/utils/dynamodb'

withFeatureHook(['RISK_SCORING', 'RISK_LEVELS'])
dynamoDbSetupHook()

test('User KRS Score: no risk score details', async () => {
  const tenantId = getTestTenantId()
  const user = getTestUser()
  const userKRSScore = await USER_KRS_SCORE.load(user, {
    tenantId,
    dynamoDb: getDynamoDbClient(),
  } as LogicVariableContext)

  expect(userKRSScore).toBe(undefined)
})

test('User KRS Score: with risk score details', async () => {
  const tenantId = getTestTenantId()
  const user = getTestUser()
  await createConsumerUser(tenantId, user)
  const userKRSScore = await USER_KRS_SCORE.load(user, {
    tenantId,
    dynamoDb: getDynamoDbClient(),
  } as LogicVariableContext)

  expect(userKRSScore).toBe(90)
})
