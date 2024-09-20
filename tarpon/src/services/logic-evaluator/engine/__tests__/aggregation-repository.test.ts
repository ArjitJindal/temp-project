import { AggregationRepository } from '../aggregation-repository'
import { dynamoDbSetupHook } from '@/test-utils/dynamodb-test-utils'
import { getTestTenantId } from '@/test-utils/tenant-test-utils'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { getTestRuleInstance } from '@/test-utils/rule-test-utils'
import { LogicAggregationVariable } from '@/@types/openapi-internal/LogicAggregationVariable'
import { RuleInstance } from '@/@types/openapi-internal/RuleInstance'

dynamoDbSetupHook()
describe('AggregationRepository', () => {
  let aggregationRepository: AggregationRepository
  const tenantId = getTestTenantId()
  beforeEach(async () => {
    const dynamoDb = getDynamoDbClient()
    aggregationRepository = new AggregationRepository(tenantId, dynamoDb)
  })
  describe('updateLogicAggVars', () => {
    test('should update the logic aggregation variables for new entity and then add it to same usedAggVariable for new variable', async () => {
      const time = Date.now() - 1
      const aggregationVariable: LogicAggregationVariable = {
        key: 'agg:123',
        type: 'USER_TRANSACTIONS',
        userDirection: 'SENDER',
        transactionDirection: 'SENDING',
        aggregationFieldKey: 'TRANSACTION:transactionId',
        aggregationFunc: 'COUNT',
        timeWindow: {
          start: { units: 30, granularity: 'day' },
          end: { units: 0, granularity: 'day' },
        },
        includeCurrentEntity: true,
      }
      const ruleInstance = getTestRuleInstance({
        id: 'Test1',
        logicAggregationVariables: [aggregationVariable],
      })
      const logicAggVars = await aggregationRepository.updateLogicAggVars(
        ruleInstance,
        'Test1'
      )
      expect(logicAggVars[0].version).toBeGreaterThan(time)
      const usedAggVar = await aggregationRepository.getUsedAggVar(
        aggregationVariable,
        1
      )
      expect(usedAggVar.usedEntityIds).toEqual(['Test1'])
      const aggregationVariable2: LogicAggregationVariable = {
        key: 'agg:123',
        type: 'USER_TRANSACTIONS',
        userDirection: 'SENDER',
        transactionDirection: 'SENDING',
        aggregationFieldKey: 'TRANSACTION:transactionId',
        aggregationFunc: 'COUNT',
        timeWindow: {
          start: { units: 30, granularity: 'day' },
          end: { units: 0, granularity: 'day' },
        },
        includeCurrentEntity: true,
      }
      const ruleInstance2 = getTestRuleInstance({
        id: 'Test2',
        logicAggregationVariables: [aggregationVariable2],
      })
      const logicAggVars2 = await aggregationRepository.updateLogicAggVars(
        ruleInstance2,
        'Test2'
      )
      expect(logicAggVars2[0].version).toEqual(logicAggVars[0].version)
      const usedAggVar2 = await aggregationRepository.getUsedAggVar(
        aggregationVariable,
        1
      )
      expect(usedAggVar2.usedEntityIds).toEqual(['Test1', 'Test2'])
    })
  })
  test('should remove entity from usedAggVar and get new version', async () => {
    const oldAggregationVariable: LogicAggregationVariable = {
      key: 'agg:123',
      type: 'USER_TRANSACTIONS',
      userDirection: 'RECEIVER',
      transactionDirection: 'RECEIVING',
      aggregationFieldKey: 'TRANSACTION:originAmountDetails-transactionAmount',
      aggregationFunc: 'SUM',
      timeWindow: {
        start: { units: 30, granularity: 'day' },
        end: { units: 0, granularity: 'day' },
      },
      baseCurrency: 'USD',
      includeCurrentEntity: true,
    }
    const ruleInstanceBefore = getTestRuleInstance({
      id: 'Test-Removal-1',
      logicAggregationVariables: [oldAggregationVariable],
    })
    const logicAggVars = await aggregationRepository.updateLogicAggVars(
      ruleInstanceBefore,
      'Test-Removal-1'
    )
    const usedAggVar1 = await aggregationRepository.getUsedAggVar(
      oldAggregationVariable,
      1
    )
    expect(usedAggVar1.usedEntityIds).toEqual(['Test-Removal-1'])
    const newAggregationVariable: LogicAggregationVariable = {
      ...oldAggregationVariable,
      aggregationFunc: 'AVG',
    }
    const ruleInstanceAfter: RuleInstance = {
      ...ruleInstanceBefore,
      logicAggregationVariables: [newAggregationVariable],
    }
    const logicAggVars2 = await aggregationRepository.updateLogicAggVars(
      ruleInstanceAfter,
      'Test-Removal-1',
      ruleInstanceBefore
    )
    expect(logicAggVars[0].version).not.toEqual(logicAggVars2[0].version)
    const usedAggVar1After = await aggregationRepository.getUsedAggVar(
      oldAggregationVariable,
      1
    )
    expect(usedAggVar1After.usedEntityIds).toEqual([])
    const usedAggVar2 = await aggregationRepository.getUsedAggVar(
      newAggregationVariable,
      1
    )
    expect(usedAggVar2.usedEntityIds).toEqual(['Test-Removal-1'])
  })
})
