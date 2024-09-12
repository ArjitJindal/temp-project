import { createConsumerUser, getTestUser } from '@/test-utils/user-test-utils'
import { getTestTenantId } from '@/test-utils/tenant-test-utils'
import { RuleVariableContext } from '@/services/rules-engine/v8-variables/types'
import { USER_CRA_SCORE } from '@/services/rules-engine/v8-variables/user-cra-score'
import { withFeatureHook } from '@/test-utils/feature-test-utils'
import { dynamoDbSetupHook } from '@/test-utils/dynamodb-test-utils'
import { getDynamoDbClient } from '@/utils/dynamodb'

withFeatureHook(['RISK_SCORING', 'RISK_LEVELS'])
dynamoDbSetupHook()

test('User CRA Score: no risk score details', async () => {
  const tenantId = getTestTenantId()
  const user = getTestUser()
  const craScore = await USER_CRA_SCORE.load(user, {
    tenantId,
    dynamoDb: getDynamoDbClient(),
  } as RuleVariableContext)

  expect(craScore).toBe(undefined)
})

test('User CRA Score: with risk score details', async () => {
  const tenantId = getTestTenantId()
  const user = getTestUser()
  await createConsumerUser(tenantId, user)
  const craScore = await USER_CRA_SCORE.load(user, {
    tenantId,
    dynamoDb: getDynamoDbClient(),
  } as RuleVariableContext)

  expect(craScore).toBe(90)
})
