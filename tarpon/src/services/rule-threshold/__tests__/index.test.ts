import { RuleThresholdOptimizer } from '../index'
import { VarOptimizationData } from '../types'

describe('RuleThresholdOptimizer', () => {
  describe('calculateThreshold', () => {
    // Create minimal instance for testing just calculateThreshold
    const optimizer = new RuleThresholdOptimizer('test-tenant-id', {
      dynamoDb: {} as any,
      mongoDb: {} as any,
    })

    it('should calculate threshold correctly for typical values', () => {
      const testData: VarOptimizationData = {
        varKey: 'test_var',
        FP: {
          count: 10,
          sum: 100,
          sumOfSquares: 1100, // This will give variance = 10
        },
        TP: {
          count: 10,
          sum: 200,
          sumOfSquares: 4100, // This will give variance = 9
        },
      }

      const result = optimizer.calculateThreshold(testData)
      expect(result.varKey).toBe('test_var')
      expect(result.threshold).toBeDefined()
    })

    it('should handle edge case with zero counts', () => {
      const testData: VarOptimizationData = {
        varKey: 'test_var',
        FP: {
          count: 0,
          sum: 0,
          sumOfSquares: 0,
        },
        TP: {
          count: 0,
          sum: 0,
          sumOfSquares: 0,
        },
      }
      const result = optimizer.calculateThreshold(testData)
      expect(result.varKey).toBe('test_var')
      expect(result.threshold).toBe(0)
    })

    it('should handle undefined data', () => {
      const testData: VarOptimizationData = {
        varKey: 'test_var',
        FP: undefined,
        TP: undefined,
      }

      const result = optimizer.calculateThreshold(testData)
      expect(result.varKey).toBe('test_var')
      expect(result.threshold).toBe(0)
    })

    it('should handle negative values', () => {
      const testData: VarOptimizationData = {
        varKey: 'test_var',
        FP: {
          count: 2,
          sum: -10,
          sumOfSquares: 50,
        },
        TP: {
          count: 2,
          sum: -20,
          sumOfSquares: 200,
        },
      }

      const result = optimizer.calculateThreshold(testData)
      expect(result.varKey).toBe('test_var')
      expect(result.threshold).toBeDefined()
      expect(typeof result.threshold).toBe('number')
    })
  })
})
