import { sum } from 'lodash'
import { LogicVariableAggregator } from './types'

export interface StdDevSample {
  sumOfSquares: number
  count: number
  sum: number
}

function calculateFinalStdev(samples: StdDevSample[]) {
  // 1. Accumulate total count, sum, sumOfSquares
  let N = 0
  let sumTotal = 0
  let sumOfSquaresTotal = 0

  for (const s of samples) {
    N += s.count
    sumTotal += s.sum
    sumOfSquaresTotal += s.sumOfSquares
  }
  // Edge case
  if (N === 0) {
    return 0
  }
  // 2. Overall mean
  const mean = sumTotal / N
  // 3. Variance = (sumOfSquares / N) - mean^2
  const variance = sumOfSquaresTotal / N - mean * mean
  // 4. Standard deviation
  return Number(Math.sqrt(variance).toFixed(4))
}

export const STDEV: LogicVariableAggregator<number, StdDevSample, number> = {
  returnValueType: 'number',
  init: () => ({ sumOfSquares: 0, count: 0, sum: 0 }),
  aggregate: (values) => ({
    count: values.length,
    sum: sum(values),
    sumOfSquares: sum(values.map((value) => value * value)),
  }),
  reduce: (aggregation, value) => ({
    count: aggregation.count + 1,
    sum: aggregation.sum + sum(value),
    sumOfSquares:
      aggregation.sumOfSquares + sum(value.map((value) => value * value)),
  }),
  merge: (aggregation1, aggregation2) => ({
    count: aggregation1.count + aggregation2.count,
    sum: aggregation1.sum + aggregation2.sum,
    sumOfSquares: aggregation1.sumOfSquares + aggregation2.sumOfSquares,
  }),
  compute: (aggregation) => calculateFinalStdev([aggregation]),
}
