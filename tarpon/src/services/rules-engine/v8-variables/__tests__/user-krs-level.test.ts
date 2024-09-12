import { DEFAULT_RISK_LEVEL } from '@flagright/lib/utils'
import { createConsumerUser, getTestUser } from '@/test-utils/user-test-utils'
import { getTestTenantId } from '@/test-utils/tenant-test-utils'
import { RuleVariableContext } from '@/services/rules-engine/v8-variables/types'
import { withFeatureHook } from '@/test-utils/feature-test-utils'
import { dynamoDbSetupHook } from '@/test-utils/dynamodb-test-utils'
import { USER_KRS_LEVEL } from '@/services/rules-engine/v8-variables/user-krs-level'
import { getDynamoDbClient } from '@/utils/dynamodb'

withFeatureHook(['RISK_SCORING', 'RISK_LEVELS'])
dynamoDbSetupHook()

test('User KRS Level: no risk score details', async () => {
  const tenantId = getTestTenantId()
  const user = getTestUser()
  const userKRSLevel = await USER_KRS_LEVEL.load(user, {
    tenantId,
    dynamoDb: getDynamoDbClient(),
  } as RuleVariableContext)

  expect(userKRSLevel).toBe(DEFAULT_RISK_LEVEL)
})

test('User KRS Level: with risk score details', async () => {
  const tenantId = getTestTenantId()
  const user = getTestUser()
  await createConsumerUser(tenantId, user)
  const userKRSLevel = await USER_KRS_LEVEL.load(user, {
    tenantId,
    dynamoDb: getDynamoDbClient(),
  } as RuleVariableContext)

  expect(userKRSLevel).toBe('VERY_HIGH')
})
