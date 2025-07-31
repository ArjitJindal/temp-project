import { RiskService } from '..'
import { getTestTenantId } from '@/test-utils/tenant-test-utils'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import { dynamoDbSetupHook } from '@/test-utils/dynamodb-test-utils'
import { thunderSchemaSetupHook } from '@/test-utils/clickhouse-test-utils'

dynamoDbSetupHook()

describe('Risk Service Tests for V8', () => {
  const tenantId = getTestTenantId()
  thunderSchemaSetupHook(tenantId, ['version_history'])

  test('Risk Factor API', async () => {
    const mongoDb = await getMongoDbClient()
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

  test('Bulk Update Risk Factors API', async () => {
    const mongoDb = await getMongoDbClient()
    const dynamoDb = getDynamoDbClient()

    const riskService = new RiskService(tenantId, { dynamoDb, mongoDb })

    // Create two risk factors first
    const riskFactor1 = (
      await riskService.createOrUpdateRiskFactor({
        name: 'Risk Factor 1',
        description: 'Risk Factor 1',
        status: 'ACTIVE',
        logicAggregationVariables: [],
        logicEntityVariables: [],
        defaultWeight: 1,
        type: 'BUSINESS',
      })
    ).result

    const riskFactor2 = (
      await riskService.createOrUpdateRiskFactor({
        name: 'Risk Factor 2',
        description: 'Risk Factor 2',
        status: 'ACTIVE',
        logicAggregationVariables: [],
        logicEntityVariables: [],
        defaultWeight: 1,
        type: 'CONSUMER_USER',
      })
    ).result

    // Verify initial state
    const initialRiskFactors = await riskService.getAllRiskFactors()
    expect(initialRiskFactors).toHaveLength(2)

    // Perform bulk update
    const updatedRiskFactors = [
      {
        ...riskFactor1,
        name: 'Updated Risk Factor 1',
        description: 'Updated Risk Factor 1',
      },
      {
        ...riskFactor2,
        name: 'Updated Risk Factor 2',
        description: 'Updated Risk Factor 2',
      },
    ]

    const bulkUpdateResult = await riskService.bulkUpdateRiskFactors(
      updatedRiskFactors,
      'Bulk update test'
    )

    expect(bulkUpdateResult).toBeDefined()
    expect(bulkUpdateResult.entities).toHaveLength(2)
    expect(bulkUpdateResult.actionTypeOverride).toBe('UPDATE')

    // Verify the updates were applied
    const finalRiskFactors = await riskService.getAllRiskFactors()
    expect(finalRiskFactors).toHaveLength(2)

    const updatedFactor1 = finalRiskFactors.find(
      (rf) => rf.id === riskFactor1.id
    )
    const updatedFactor2 = finalRiskFactors.find(
      (rf) => rf.id === riskFactor2.id
    )

    expect(updatedFactor1?.name).toBe('Updated Risk Factor 1')
    expect(updatedFactor1?.description).toBe('Updated Risk Factor 1')
    expect(updatedFactor2?.name).toBe('Updated Risk Factor 2')
    expect(updatedFactor2?.description).toBe('Updated Risk Factor 2')

    // Clean up
    await Promise.all([
      riskService.deleteRiskFactor(riskFactor1.id),
      riskService.deleteRiskFactor(riskFactor2.id),
    ])
  })
})
