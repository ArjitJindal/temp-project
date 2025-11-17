import PolicyBuilder from '@/core/policies/policy-generator'

describe('PolicyBuilder', () => {
  test('policy less than character limit', async () => {
    // Test with all methods used in production (jwt-authorizer and api-key-authorizer)
    const policy = JSON.stringify(
      new PolicyBuilder('flagright')
        .s3()
        .secretsManager()
        .dynamoDb()
        .opensearch()
        .build()
    )
    expect(policy.length).toBeLessThan(2_048)
  })
})
