import { RuleInstanceRepository } from '../rule-instance-repository'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { getTestTenantId } from '@/test-utils/tenant-test-utils'
import { getTestRuleInstance } from '@/test-utils/rule-test-utils'

const dynamoDb = getDynamoDbClient()

describe('createOrUpdateRuleInstance', () => {
  test('saved a new rule instance', async () => {
    const TEST_TENANT_ID = getTestTenantId()
    const ruleInstanceRepository = new RuleInstanceRepository(TEST_TENANT_ID, {
      dynamoDb,
    })
    const ruleInstance = getTestRuleInstance({})
    await ruleInstanceRepository.createOrUpdateRuleInstance(ruleInstance)
    const savedRuleInstance = await ruleInstanceRepository.getRuleInstanceById(
      ruleInstance.id!
    )
    expect(savedRuleInstance).toMatchObject(ruleInstance)
  })

  test('updated an existing rule instance', async () => {
    const TEST_TENANT_ID = getTestTenantId()
    const ruleInstanceRepository = new RuleInstanceRepository(TEST_TENANT_ID, {
      dynamoDb,
    })
    const ruleInstance = getTestRuleInstance({})
    await ruleInstanceRepository.createOrUpdateRuleInstance(ruleInstance)
    const updatedRuleInstance = {
      ...ruleInstance,
      ruleNameAlias: 'updated name',
    }
    await ruleInstanceRepository.createOrUpdateRuleInstance(updatedRuleInstance)
    const savedRuleInstance = await ruleInstanceRepository.getRuleInstanceById(
      ruleInstance.id!
    )
    expect(savedRuleInstance).toMatchObject(updatedRuleInstance)
  })

  describe('logicAggregationVariables version', () => {
    const TEST_TENANT_ID = getTestTenantId()
    const ruleInstanceRepository = new RuleInstanceRepository(TEST_TENANT_ID, {
      dynamoDb,
    })
    const TEST_RULE_INSTANCE_1 = getTestRuleInstance({
      id: 'r-1',
      logicAggregationVariables: [
        {
          key: 'agg:1',
          type: 'USER_TRANSACTIONS',
          transactionDirection: 'SENDING_RECEIVING',
          aggregationFieldKey: 'TRANSACTION:transactionId',
          aggregationFunc: 'COUNT',
          timeWindow: {
            start: { units: 1, granularity: 'day' },
            end: { units: 0, granularity: 'day' },
          },
          version: 1,
        },
      ],
    })
    const TEST_RULE_INSTANCE_2 = {
      ...TEST_RULE_INSTANCE_1,
      id: 'r-2',
    }

    test('sets version for a newly created aggregation variable', async () => {
      const now = Date.now()
      await ruleInstanceRepository.createOrUpdateRuleInstance(
        TEST_RULE_INSTANCE_1
      )
      const savedRuleInstance =
        await ruleInstanceRepository.getRuleInstanceById(
          TEST_RULE_INSTANCE_1.id!
        )
      expect(
        savedRuleInstance!.logicAggregationVariables![0].version
      ).toBeGreaterThanOrEqual(now)
    })

    test("updating the properties that won't trigger a rebuild won't update the version", async () => {
      const beforeRuleInstance =
        (await ruleInstanceRepository.getRuleInstanceById(
          TEST_RULE_INSTANCE_1.id!
        ))!
      await ruleInstanceRepository.createOrUpdateRuleInstance({
        ...beforeRuleInstance,
        logicAggregationVariables:
          beforeRuleInstance.logicAggregationVariables?.map((v) => ({
            ...v,
            name: v.name + '-1',
          })),
      })
      const afterRuleInstance =
        await ruleInstanceRepository.getRuleInstanceById(
          TEST_RULE_INSTANCE_1.id!
        )
      expect(beforeRuleInstance!.logicAggregationVariables![0].version).toBe(
        afterRuleInstance!.logicAggregationVariables![0].version
      )
    })

    test('uses the same version as the existing active aggregation variable', async () => {
      await ruleInstanceRepository.createOrUpdateRuleInstance(
        TEST_RULE_INSTANCE_2
      )
      const ruleInstance1 = await ruleInstanceRepository.getRuleInstanceById(
        TEST_RULE_INSTANCE_1.id!
      )

      const ruleInstance2 = await ruleInstanceRepository.getRuleInstanceById(
        TEST_RULE_INSTANCE_2.id!
      )
      expect(ruleInstance2!.logicAggregationVariables![0].version).toBe(
        ruleInstance1!.logicAggregationVariables![0].version
      )
    })

    test("version isn't changed if disabled and enabled (when there's a same agg var in other rule instances)", async () => {
      const beforeRuleInstance =
        await ruleInstanceRepository.getRuleInstanceById(
          TEST_RULE_INSTANCE_1.id!
        )
      await ruleInstanceRepository.createOrUpdateRuleInstance({
        ...beforeRuleInstance!,
        status: 'INACTIVE',
      })
      await ruleInstanceRepository.createOrUpdateRuleInstance({
        ...beforeRuleInstance!,
        status: 'ACTIVE',
      })
      const afterRuleInstance =
        await ruleInstanceRepository.getRuleInstanceById(
          TEST_RULE_INSTANCE_1.id!
        )
      expect(beforeRuleInstance!.logicAggregationVariables![0].version).toBe(
        afterRuleInstance!.logicAggregationVariables![0].version
      )
    })

    test("version is updated if disabled and enabled (when there's no same agg var in other rule instances)", async () => {
      const beforeRuleInstance1 =
        await ruleInstanceRepository.getRuleInstanceById(
          TEST_RULE_INSTANCE_1.id!
        )
      const beforeRuleInstance2 =
        await ruleInstanceRepository.getRuleInstanceById(
          TEST_RULE_INSTANCE_2.id!
        )
      await ruleInstanceRepository.createOrUpdateRuleInstance({
        ...beforeRuleInstance1!,
        status: 'INACTIVE',
      })
      await ruleInstanceRepository.createOrUpdateRuleInstance({
        ...beforeRuleInstance2!,
        status: 'INACTIVE',
      })
      await ruleInstanceRepository.createOrUpdateRuleInstance({
        ...beforeRuleInstance1!,
        status: 'ACTIVE',
      })
      const afterRuleInstance1 =
        await ruleInstanceRepository.getRuleInstanceById(
          TEST_RULE_INSTANCE_1.id!
        )
      expect(
        afterRuleInstance1!.logicAggregationVariables![0].version
      ).toBeGreaterThan(
        beforeRuleInstance1!.logicAggregationVariables![0].version!
      )
    })

    test('version is updated if aggregation configuration is changed back the old value', async () => {
      const beforeRuleInstance1 =
        await ruleInstanceRepository.getRuleInstanceById(
          TEST_RULE_INSTANCE_1.id!
        )
      await ruleInstanceRepository.createOrUpdateRuleInstance({
        ...beforeRuleInstance1!,
        logicAggregationVariables: [
          {
            ...beforeRuleInstance1!.logicAggregationVariables![0],
            aggregationFunc: 'AVG',
          },
        ],
      })
      await ruleInstanceRepository.createOrUpdateRuleInstance({
        ...beforeRuleInstance1!,
        logicAggregationVariables: [
          {
            ...beforeRuleInstance1!.logicAggregationVariables![0],
            aggregationFunc: 'COUNT',
          },
        ],
      })
      const afterRuleInstance1 =
        await ruleInstanceRepository.getRuleInstanceById(
          TEST_RULE_INSTANCE_1.id!
        )
      expect(
        afterRuleInstance1!.logicAggregationVariables![0].version
      ).toBeGreaterThan(
        beforeRuleInstance1!.logicAggregationVariables![0].version!
      )
    })
  })
})
