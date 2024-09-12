import { createConsumerUser, getTestUser } from '@/test-utils/user-test-utils'
import { USER_KRS_SCORE } from '@/services/rules-engine/v8-variables/user-krs-score'
import { getTestTenantId } from '@/test-utils/tenant-test-utils'
import { RuleVariableContext } from '@/services/rules-engine/v8-variables/types'
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
  } as RuleVariableContext)

  expect(userKRSScore).toBe(undefined)
})

test('User KRS Score: with risk score details', async () => {
  const tenantId = getTestTenantId()
  const user = getTestUser()
  await createConsumerUser(tenantId, user)
  const userKRSScore = await USER_KRS_SCORE.load(user, {
    tenantId,
    dynamoDb: getDynamoDbClient(),
  } as RuleVariableContext)

  expect(userKRSScore).toBe(90)
})
