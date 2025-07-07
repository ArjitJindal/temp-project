import { omit } from 'lodash'
import { ObjectId } from 'mongodb'
import { v4 as uuidv4 } from 'uuid'
import { SimulationResult, WithId } from '../simulation-result-repository'
import { getSimulationResultRepository } from './utils'
import { getTestTenantId } from '@/test-utils/tenant-test-utils'
import { withFeaturesToggled } from '@/test-utils/feature-test-utils'
import { dynamoDbSetupHook } from '@/test-utils/dynamodb-test-utils'
import { RiskLevel } from '@/@types/openapi-internal/RiskLevel'
import { SimulationRiskLevelsResult } from '@/@types/openapi-internal/SimulationRiskLevelsResult'
import { SimulationBeaconTransactionResult } from '@/@types/openapi-internal/SimulationBeaconTransactionResult'
import { SimulationBeaconResultUser } from '@/@types/openapi-internal/SimulationBeaconResultUser'
import { SimulationV8RiskFactorsResult } from '@/@types/openapi-internal/SimulationV8RiskFactorsResult'

dynamoDbSetupHook()

const createSimulationResult = (
  overrides: Partial<
    WithId<
      | SimulationRiskLevelsResult
      | SimulationV8RiskFactorsResult
      | SimulationBeaconResultUser
      | SimulationBeaconTransactionResult
    >
  >
) => {
  const baseResult: SimulationRiskLevelsResult = {
    taskId: uuidv4(),
    type: 'PULSE',
    userId: uuidv4(),
    userName: 'test',
    current: {
      krs: { riskLevel: 'VERY_LOW', riskScore: 10 },
      drs: { riskLevel: 'VERY_LOW', riskScore: 10 },
    },
    simulated: {
      krs: { riskLevel: 'VERY_LOW', riskScore: 10 },
      drs: { riskLevel: 'VERY_LOW', riskScore: 10 },
    },
  }
  return { ...baseResult, ...overrides } as SimulationResult
}

withFeaturesToggled([], ['CLICKHOUSE_ENABLED', 'CLICKHOUSE_MIGRATION'], () => {
  describe('SimulationResultRepository', () => {
    let tenantId: string
    let simulationResultRepository: any
    let simulationResult: SimulationResult

    beforeEach(async () => {
      tenantId = getTestTenantId()
      simulationResultRepository = await getSimulationResultRepository(tenantId)
      simulationResult = createSimulationResult({
        _id: new ObjectId(),
      })
      await simulationResultRepository.saveSimulationResults([simulationResult])
    })

    it('should save and retrieve simulation result', async () => {
      const savedSimulationResult =
        await simulationResultRepository.getSimulationResults({
          taskId: (simulationResult as SimulationRiskLevelsResult).taskId,
        })
      expect(savedSimulationResult.items[0]).toEqual(
        expect.objectContaining(omit(simulationResult, ['_id', 'id']))
      )
    })

    it('should filter by current KRS risk level', async () => {
      const result = await simulationResultRepository.getSimulationResults({
        taskId: (simulationResult as SimulationRiskLevelsResult).taskId,
        filterCurrentKrsLevel: ['VERY_LOW'] as RiskLevel[],
      })
      expect(result.items).toHaveLength(1)
      const item = result.items[0] as SimulationRiskLevelsResult
      expect(item?.current?.krs?.riskLevel).toBe('VERY_LOW')
    })

    it('should filter by simulated KRS risk level', async () => {
      const result = await simulationResultRepository.getSimulationResults({
        taskId: (simulationResult as SimulationRiskLevelsResult).taskId,
        filterSimulationKrsLevel: ['VERY_LOW'] as RiskLevel[],
      })
      expect(result.items).toHaveLength(1)
      const item = result.items[0] as SimulationRiskLevelsResult
      expect(item?.simulated?.krs?.riskLevel).toBe('VERY_LOW')
    })

    it('should filter by current DRS risk level', async () => {
      const result = await simulationResultRepository.getSimulationResults({
        taskId: (simulationResult as SimulationRiskLevelsResult).taskId,
        filterCurrentDrsLevel: ['VERY_LOW'] as RiskLevel[],
      })
      expect(result.items).toHaveLength(1)
      const item = result.items[0] as SimulationRiskLevelsResult
      expect(item?.current?.drs?.riskLevel).toBe('VERY_LOW')
    })

    it('should filter by simulated DRS risk level', async () => {
      const result = await simulationResultRepository.getSimulationResults({
        taskId: (simulationResult as SimulationRiskLevelsResult).taskId,
        filterSimulationDrsLevel: ['VERY_LOW'] as RiskLevel[],
      })
      expect(result.items).toHaveLength(1)
      const item = result.items[0] as SimulationRiskLevelsResult
      expect(item?.simulated?.drs?.riskLevel).toBe('VERY_LOW')
    })

    it('should filter by type', async () => {
      const result = await simulationResultRepository.getSimulationResults({
        taskId: (simulationResult as SimulationRiskLevelsResult).taskId,
        filterType: 'PULSE',
      })
      expect(result.items).toHaveLength(1)
      const item = result.items[0] as SimulationRiskLevelsResult
      expect(item?.type).toBe('PULSE')
    })

    it('should filter by user ID', async () => {
      const result = await simulationResultRepository.getSimulationResults({
        taskId: (simulationResult as SimulationRiskLevelsResult).taskId,
        filterUserId: (simulationResult as SimulationRiskLevelsResult).userId,
      })
      expect(result.items).toHaveLength(1)
      const item = result.items[0] as SimulationRiskLevelsResult
      expect(item?.userId).toBe(
        (simulationResult as SimulationRiskLevelsResult).userId
      )
    })

    it('should filter by transaction ID', async () => {
      const transactionId = uuidv4()
      const transactionResult = createSimulationResult({
        _id: new ObjectId(),
        type: 'BEACON_TRANSACTION',
        transactionId,
      })
      await simulationResultRepository.saveSimulationResults([
        transactionResult,
      ])

      const result = await simulationResultRepository.getSimulationResults({
        taskId: transactionResult.taskId,
        filterTransactionId: transactionId,
      })
      expect(result.items).toHaveLength(1)
      expect(result.items[0].transactionId).toBe(transactionId)
    })

    it('should filter by origin payment method', async () => {
      const paymentMethod = 'CARD'
      const paymentResult = createSimulationResult({
        _id: new ObjectId(),
        type: 'BEACON_TRANSACTION',
        originPaymentDetails: {
          paymentMethod,
          paymentMethodId: uuidv4(),
        },
      })
      await simulationResultRepository.saveSimulationResults([paymentResult])

      const result = await simulationResultRepository.getSimulationResults({
        taskId: paymentResult.taskId,
        filterOriginPaymentMethod: paymentMethod,
      })
      expect(result.items).toHaveLength(1)
      expect(result.items[0].originPaymentDetails.paymentMethod).toBe(
        paymentMethod
      )
    })

    it('should filter by destination payment method', async () => {
      const paymentMethod = 'ACH'
      const paymentResult = createSimulationResult({
        _id: new ObjectId(),
        type: 'BEACON_TRANSACTION',
        destinationPaymentDetails: {
          paymentMethod,
          paymentMethodId: uuidv4(),
        },
      })
      await simulationResultRepository.saveSimulationResults([paymentResult])

      const result = await simulationResultRepository.getSimulationResults({
        taskId: paymentResult.taskId,
        filterDestinationPaymentMethod: paymentMethod,
      })
      expect(result.items).toHaveLength(1)
      expect(result.items[0].destinationPaymentDetails.paymentMethod).toBe(
        paymentMethod
      )
    })

    it('should filter by transaction types', async () => {
      const transactionType = 'TRANSFER'
      const transactionResult = createSimulationResult({
        _id: new ObjectId(),
        type: 'BEACON_TRANSACTION',
        transactionType,
      })
      await simulationResultRepository.saveSimulationResults([
        transactionResult,
      ])

      const result = await simulationResultRepository.getSimulationResults({
        taskId: transactionResult.taskId,
        filterTransactionTypes: [transactionType],
      })
      expect(result.items).toHaveLength(1)
      expect(result.items[0].transactionType).toBe(transactionType)
    })

    it('should filter by hit status', async () => {
      const hitStatus = 'HIT'
      const hitResult = createSimulationResult({
        _id: new ObjectId(),
        type: 'BEACON_TRANSACTION',
        hit: hitStatus,
      })
      await simulationResultRepository.saveSimulationResults([hitResult])

      const result = await simulationResultRepository.getSimulationResults({
        taskId: hitResult.taskId,
        filterHitStatus: hitStatus,
      })
      expect(result.items).toHaveLength(1)
      expect(result.items[0].hit).toBe(hitStatus)
    })

    it('should filter by rule action', async () => {
      const ruleAction = 'SUSPEND'
      const actionResult = createSimulationResult({
        _id: new ObjectId(),
        type: 'BEACON_TRANSACTION',
        action: ruleAction,
      })
      await simulationResultRepository.saveSimulationResults([actionResult])

      const result = await simulationResultRepository.getSimulationResults({
        taskId: actionResult.taskId,
        filterRuleAction: ruleAction,
      })
      expect(result.items).toHaveLength(1)
      expect(result.items[0].action).toBe(ruleAction)
    })
  })
})
