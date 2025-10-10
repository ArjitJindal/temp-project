import PolicyBuilder from '@/core/policies/policy-generator'

describe('PolicyBuilder', () => {
  test('policy less than character limit', async () => {
    const policy = JSON.stringify(
      new PolicyBuilder('flagright').s3().secretsManager().dynamoDb().build()
    )
    expect(policy.length).toBeLessThan(2_048)
  })
})
