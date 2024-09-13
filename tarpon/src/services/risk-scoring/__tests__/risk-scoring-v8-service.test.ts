import { RiskScoringV8Service } from '../risk-scoring-v8-service'
import { getTestTenantId } from '@/test-utils/tenant-test-utils'
import { getMongoDbClient } from '@/utils/mongodb-utils'

describe('V8 Risk scoring ', () => {
  describe('V8 Risk Scoring Algorithms', () => {
    const tenantId = getTestTenantId()
    describe('Calculation for Transaction', () => {
      test('should calculate new drs score using ars legacy moving avg', async () => {
        const mongoDb = await getMongoDbClient()
        const riskScoringService = new RiskScoringV8Service(tenantId, {
          mongoDb,
        })
        const newDrsScore1 = riskScoringService.calculateNewDrsScore({
          algorithm: {
            type: 'FORMULA_LEGACY_MOVING_AVG',
          },
          oldDrsScore: undefined,
          krsScore: 20,
          avgArsScore: 10,
          arsScore: 10,
        })
        expect(newDrsScore1).toBe(15)
        const newDrsScore2 = riskScoringService.calculateNewDrsScore({
          algorithm: {
            type: 'FORMULA_LEGACY_MOVING_AVG',
          },
          oldDrsScore: 10,
          krsScore: 20,
          avgArsScore: 10,
          arsScore: 10,
        })
        expect(newDrsScore2).toBe(10)
      })
      test('should calculate new drs score using ars simple avg', async () => {
        const mongoDb = await getMongoDbClient()
        const riskScoringService = new RiskScoringV8Service(tenantId, {
          mongoDb,
        })
        const newDrsScore = riskScoringService.calculateNewDrsScore({
          algorithm: {
            type: 'FORMULA_SIMPLE_AVG',
          },
          oldDrsScore: undefined,
          krsScore: 20,
          avgArsScore: 10,
          arsScore: 10,
        })
        expect(newDrsScore).toBe(15)
        const newDrsScore2 = riskScoringService.calculateNewDrsScore({
          algorithm: {
            type: 'FORMULA_SIMPLE_AVG',
          },
          oldDrsScore: 10,
          krsScore: 20,
          avgArsScore: 10,
          arsScore: 10,
        })
        expect(newDrsScore2).toBe(15)
      })
      test('should calculate new drs score using ars custom', async () => {
        const mongoDb = await getMongoDbClient()
        const riskScoringService = new RiskScoringV8Service(tenantId, {
          mongoDb,
        })
        const newDrsScore = riskScoringService.calculateNewDrsScore({
          algorithm: {
            type: 'FORMULA_CUSTOM',
            krsWeight: 0.4,
            avgArsWeight: 0.6,
          },
          oldDrsScore: undefined,
          krsScore: 20,
          avgArsScore: 10,
          arsScore: 10,
        })
        expect(newDrsScore).toBe(14)
        const newDrsScore2 = riskScoringService.calculateNewDrsScore({
          algorithm: {
            type: 'FORMULA_CUSTOM',
            krsWeight: 0.4,
            avgArsWeight: 0.6,
          },
          oldDrsScore: 10,
          krsScore: 20,
          avgArsScore: 10,
          arsScore: 10,
        })
        expect(newDrsScore2).toBe(14)
      })
    })

    describe('User Events', () => {
      let riskScoringService: RiskScoringV8Service

      beforeEach(async () => {
        const mongoDb = await getMongoDbClient()
        riskScoringService = new RiskScoringV8Service(tenantId, {
          mongoDb,
        })
      })

      test('should calculate new drs score using legacy moving avg for user event', () => {
        const newDrsScore1 = riskScoringService.calculateNewDrsScore({
          algorithm: {
            type: 'FORMULA_LEGACY_MOVING_AVG',
          },
          oldDrsScore: undefined,
          krsScore: 20,
          avgArsScore: 10,
          arsScore: 10,
          userEvent: true,
        })
        expect(newDrsScore1).toBe(20)

        const newDrsScore2 = riskScoringService.calculateNewDrsScore({
          algorithm: {
            type: 'FORMULA_LEGACY_MOVING_AVG',
          },
          oldDrsScore: 30,
          krsScore: 20,
          avgArsScore: 10,
          arsScore: 10,
          userEvent: true,
        })
        expect(newDrsScore2).toBe(25)
      })

      test('should calculate new drs score using simple avg for user event', () => {
        const newDrsScore1 = riskScoringService.calculateNewDrsScore({
          algorithm: {
            type: 'FORMULA_SIMPLE_AVG',
          },
          oldDrsScore: undefined,
          krsScore: 20,
          avgArsScore: 10,
          arsScore: 10,
          userEvent: true,
        })
        expect(newDrsScore1).toBe(15)

        const newDrsScore2 = riskScoringService.calculateNewDrsScore({
          algorithm: {
            type: 'FORMULA_SIMPLE_AVG',
          },
          oldDrsScore: 30,
          krsScore: 20,
          avgArsScore: 10,
          arsScore: 10,
          userEvent: true,
        })
        expect(newDrsScore2).toBe(15)
      })

      test('should calculate new drs score using custom formula for user event', () => {
        const newDrsScore1 = riskScoringService.calculateNewDrsScore({
          algorithm: {
            type: 'FORMULA_CUSTOM',
            krsWeight: 0.6,
            avgArsWeight: 0.4,
          },
          oldDrsScore: undefined,
          krsScore: 20,
          avgArsScore: 10,
          arsScore: 10,
          userEvent: true,
        })
        expect(newDrsScore1).toBe(16)

        const newDrsScore2 = riskScoringService.calculateNewDrsScore({
          algorithm: {
            type: 'FORMULA_CUSTOM',
            krsWeight: 0.6,
            avgArsWeight: 0.4,
          },
          oldDrsScore: 30,
          krsScore: 20,
          avgArsScore: 10,
          arsScore: 10,
          userEvent: true,
        })
        expect(newDrsScore2).toBe(16)
      })
    })
  })
})
