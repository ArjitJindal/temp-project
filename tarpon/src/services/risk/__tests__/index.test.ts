import { RiskService } from '..'
import { getTestTenantId } from '@/test-utils/tenant-test-utils'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import { ParameterAttributeValuesV8Request } from '@/@types/openapi-internal/ParameterAttributeValuesV8Request'
import { dynamoDbSetupHook } from '@/test-utils/dynamodb-test-utils'

dynamoDbSetupHook()

describe('Risk Service Tests for V8', () => {
  test('Risk Classification API', async () => {
    const mongoDb = await getMongoDbClient()
    const tenantId = getTestTenantId()
    const dynamoDb = getDynamoDbClient()

    const riskService = new RiskService(tenantId, { dynamoDb, mongoDb })

    const parameterRiskItemsV8 = await riskService.getParameterRiskItemsV8()

    expect(parameterRiskItemsV8).toBeDefined()
    expect(parameterRiskItemsV8).toHaveLength(0)

    const data: ParameterAttributeValuesV8Request = {
      defaultValue: {
        type: 'RISK_LEVEL',
        value: 'LOW',
      },
      defaultWeight: 1,
      description: 'Risk level for the entity',
      isActive: true,
      logicAggregationVariables: [],
      name: 'Risk Level',
      logicEntityVariables: [],
      riskEntityType: 'BUSINESS',
      riskLevelAssignmentValues: [
        {
          logic: {},
          riskValue: {
            type: 'RISK_LEVEL',
            value: 'LOW',
          },
          weight: 1,
        },
      ],
      baseCurrency: 'USD',
    }

    const riskClassificationValues =
      await riskService.createOrUpdateRiskParameterV8(data)

    expect(riskClassificationValues).toBeDefined()
    expect(riskClassificationValues).toMatchObject(data)
    expect(riskClassificationValues.id).toEqual('CRF-001')

    const parameterRiskItemsV8After =
      await riskService.getParameterRiskItemsV8()

    expect(parameterRiskItemsV8After).toBeDefined()
    expect(parameterRiskItemsV8After).toHaveLength(1)
    expect(parameterRiskItemsV8After?.[0]).toMatchObject({
      id: 'CRF-001',
    })

    const riskClassificationValuesById = await riskService.getRiskParameterV8(
      'CRF-001'
    )

    expect(riskClassificationValuesById).toBeDefined()
    expect(riskClassificationValuesById).toMatchObject(data)

    const updatedData: ParameterAttributeValuesV8Request = {
      ...data,
      name: 'Risk Level Updated',
    }

    const updatedRiskClassificationValues =
      await riskService.createOrUpdateRiskParameterV8(updatedData, 'CRF-001')

    expect(updatedRiskClassificationValues).toBeDefined()
    expect(updatedRiskClassificationValues).toMatchObject(updatedData)

    await riskService.deleteRiskParameterV8('CRF-001')

    const parameterRiskItemsV8AfterDelete =
      await riskService.getParameterRiskItemsV8()

    expect(parameterRiskItemsV8AfterDelete).toMatchObject([])
  })
})
