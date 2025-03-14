import {
  sanitizeVarData,
  getNumericVarKeys,
  processTransactionVars,
  augmentVarData,
  mergeData,
} from '../utils'
import { RuleVarsOptimzationData, StdDevSampleByKey, VarData } from '../types'

describe('sanitizeVarData', () => {
  it('should remove null and undefined values from arrays', () => {
    const input = {
      key1: [1, null, 2, undefined, 3] as number[],
    }

    const expected = {
      key1: [1, 2, 3],
    }

    expect(sanitizeVarData(input)).toEqual(expected)
  })

  it('should handle empty arrays', () => {
    const input = {
      key1: [],
      key2: [null, undefined] as unknown as number[],
    }

    const expected = {
      key1: [],
      key2: [],
    }

    expect(sanitizeVarData(input)).toEqual(expected)
  })
})

describe('getNumericVarKeys', () => {
  it('should extract var keys from arithmetic comparisons', () => {
    const logic = {
      and: [{ '>': [{ var: 'amount' }, 100] }, { '<': [{ var: 'score' }, 50] }],
    }

    expect(getNumericVarKeys(logic)).toEqual(['amount', 'score'])
  })

  it('should ignore non-numeric comparisons', () => {
    const logic = {
      and: [
        { '>': [{ var: 'amount' }, 100] },
        { '==': [{ var: 'status' }, 'active'] },
      ],
    }

    expect(getNumericVarKeys(logic)).toEqual(['amount'])
  })

  it('should ignore higher order operator comparisons', () => {
    const logic = {
      some: [{ var: 'transactions' }, { '>': [{ var: 'amount' }, 1000] }],
    }

    expect(getNumericVarKeys(logic)).toEqual([])
  })

  it('should ignore invalid arithmetic comparisons', () => {
    const logic = {
      and: [
        { '>': [{ var: 'amount' }] }, // invalid: missing second argument
        { '>': ['not_var', 100] }, // invalid: first argument not a var
        { '>': [{ var: 'score' }, 'fifty'] }, // invalid: second argument not a number
      ],
    }

    expect(getNumericVarKeys(logic)).toEqual([])
  })
})

describe('processTransactionVars', () => {
  it('should process regular variables correctly', () => {
    const vars = [
      { value: { amount: 100, currency: 'USD' } },
      { value: { amount: 200, currency: 'EUR' } },
    ]
    const varKeys = ['amount', 'currency']
    const varData: Record<string, any[]> = {}

    processTransactionVars(vars, varKeys, varData)

    expect(varData).toEqual({
      amount: [100, 200],
      currency: ['USD', 'EUR'],
    })
  })

  it('should process direction-less variables correctly', () => {
    const bothDirectionsKey = `amount__BOTH`
    const vars = [
      {
        value: {
          [`amount__SENDER`]: 100,
          [`amount__RECEIVER`]: 150,
        },
      },
      {
        value: {
          [`amount__SENDER`]: 200,
          [`amount__RECEIVER`]: 250,
        },
      },
    ]
    const varKeys = [bothDirectionsKey]
    const varData: Record<string, any[]> = {}

    processTransactionVars(vars, varKeys, varData)

    expect(varData).toEqual({
      [bothDirectionsKey]: [100, 150, 200, 250],
    })
  })

  it('should handle missing data gracefully', () => {
    const vars = [{ value: { amount: 100, currency: 'USD' } }, { value: {} }]
    const varKeys = ['amount', 'currency']
    const varData: Record<string, any[]> = {}

    processTransactionVars(vars, varKeys, varData)

    expect(varData).toEqual({
      amount: [100, undefined],
      currency: ['USD', undefined],
    })
  })

  it('should append to existing varData arrays', () => {
    const vars = [{ value: { amount: 100 } }, { value: { amount: 200 } }]
    const varKeys = ['amount']
    const varData: Record<string, any[]> = {
      amount: [50],
    }

    processTransactionVars(vars, varKeys, varData)

    expect(varData).toEqual({
      amount: [50, 100, 200],
    })
  })
})

describe('augmentVarData', () => {
  it('should correctly calculate sum, count, and sumOfSquares', () => {
    const input: VarData = {
      amount: [100, 200, 300],
      count: [1, 2, 3],
    }

    const expected: StdDevSampleByKey = {
      amount: {
        sum: 600,
        count: 3,
        sumOfSquares: 140000, // 100^2 + 200^2 + 300^2
      },
      count: {
        sum: 6,
        count: 3,
        sumOfSquares: 14, // 1^2 + 2^2 + 3^2
      },
    }

    expect(augmentVarData(input)).toEqual(expected)
  })

  it('should handle empty arrays', () => {
    const input: VarData = {
      amount: [],
    }

    const expected: StdDevSampleByKey = {
      amount: {
        sum: 0,
        count: 0,
        sumOfSquares: 0,
      },
    }

    expect(augmentVarData(input)).toEqual(expected)
  })
})

describe('mergeData', () => {
  it('should merge new data with existing data for existing keys', () => {
    const existing: RuleVarsOptimzationData = {
      ruleInstanceId: 'test-1',
      variablesOptimizationData: [
        {
          varKey: 'amount',
          TP: { sum: 100, count: 2, sumOfSquares: 5000 },
        },
      ],
      updatedAt: 1000,
    }

    const newData: StdDevSampleByKey = {
      amount: {
        sum: 300,
        count: 3,
        sumOfSquares: 30000,
      },
    }

    const result = mergeData(existing, newData, 'TP')

    expect(result.variablesOptimizationData[0]).toEqual({
      varKey: 'amount',
      TP: {
        sum: 400, // 100 + 300
        count: 5, // 2 + 3
        sumOfSquares: 35000, // 5000 + 30000
      },
    })
    expect(result.updatedAt).toBeGreaterThan(1000)
  })

  it('should add new keys to existing data', () => {
    const existing: RuleVarsOptimzationData = {
      ruleInstanceId: 'test-1',
      variablesOptimizationData: [],
      updatedAt: 1000,
    }

    const newData: StdDevSampleByKey = {
      newKey: {
        sum: 100,
        count: 2,
        sumOfSquares: 5000,
      },
    }

    const result = mergeData(existing, newData, 'FP')

    expect(result.variablesOptimizationData).toHaveLength(1)
    expect(result.variablesOptimizationData[0]).toEqual({
      varKey: 'newKey',
      FP: {
        sum: 100,
        count: 2,
        sumOfSquares: 5000,
      },
    })
  })

  it('should handle merging data for different states (FP/TP)', () => {
    const existing: RuleVarsOptimzationData = {
      ruleInstanceId: 'test-1',
      variablesOptimizationData: [
        {
          varKey: 'amount',
          TP: { sum: 100, count: 2, sumOfSquares: 5000 },
        },
      ],
      updatedAt: 1000,
    }

    const newData: StdDevSampleByKey = {
      amount: {
        sum: 300,
        count: 3,
        sumOfSquares: 30000,
      },
    }

    // Add FP data to existing TP data
    const result = mergeData(existing, newData, 'FP')

    expect(result.variablesOptimizationData[0]).toEqual({
      varKey: 'amount',
      TP: { sum: 100, count: 2, sumOfSquares: 5000 },
      FP: { sum: 300, count: 3, sumOfSquares: 30000 },
    })
  })
})
