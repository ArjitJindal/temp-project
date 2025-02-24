import { RiskService } from '..'
import { getTestTenantId } from '@/test-utils/tenant-test-utils'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import { dynamoDbSetupHook } from '@/test-utils/dynamodb-test-utils'

dynamoDbSetupHook()

describe('Risk Service Tests for V8', () => {
  test('Risk Factor API', async () => {
    const mongoDb = await getMongoDbClient()
    const tenantId = getTestTenantId()
    const dynamoDb = getDynamoDbClient()

    const riskService = new RiskService(tenantId, { dynamoDb, mongoDb })

    const riskFactor = (
      await riskService.createOrUpdateRiskFactor({
        name: 'Risk Factor',
        description: 'Risk Factor',
        status: 'ACTIVE',
        logicAggregationVariables: [],
        logicEntityVariables: [],
        defaultWeight: 1,
        type: 'BUSINESS',
      })
    ).result

    const riskFactors = await riskService.getAllRiskFactors()
    expect(riskFactors).toBeDefined()
    expect(riskFactors).toHaveLength(1)
    expect(riskFactors?.[0]).toMatchObject({
      name: 'Risk Factor',
    })

    await riskService.createOrUpdateRiskFactor(
      {
        name: 'Risk Factor 2',
        description: 'Risk Factor 2',
        status: 'ACTIVE',
        logicAggregationVariables: [],
        logicEntityVariables: [],
        defaultWeight: 1,
        type: 'BUSINESS',
      },
      riskFactor.id
    )

    const riskFactorById = await riskService.getRiskFactor(riskFactor.id)
    expect(riskFactorById).toBeDefined()
    expect(riskFactorById).toMatchObject({
      name: 'Risk Factor 2',
    })

    const riskFactorsAfterUpdate = await riskService.getAllRiskFactors()

    expect(riskFactorsAfterUpdate).toBeDefined()
    expect(riskFactorsAfterUpdate).toHaveLength(1)
    expect(riskFactorsAfterUpdate?.[0]).toMatchObject({
      name: 'Risk Factor 2',
    })

    await riskService.deleteRiskFactor(riskFactor.id)

    const riskFactorsAfterDelete = await riskService.getAllRiskFactors()

    expect(riskFactorsAfterDelete).toHaveLength(0)
  })
})
