import { StackConstants } from '@lib/constants'
import PolicyBuilder from '@/core/policies/policy-generator'

describe('PolicyBuilder', () => {
  test('policy less than character limit', async () => {
    const policy = JSON.stringify(
      new PolicyBuilder('flagright')
        .s3()
        .secretsManager()
        .athena()
        .dynamoDb([
          StackConstants.TARPON_DYNAMODB_TABLE_NAME,
          StackConstants.TARPON_RULE_DYNAMODB_TABLE_NAME,
          StackConstants.HAMMERHEAD_DYNAMODB_TABLE_NAME,
        ])
        .build()
    )
    expect(policy.length).toBeLessThan(2_048)
  })
})
