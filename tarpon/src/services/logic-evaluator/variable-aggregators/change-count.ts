import { LogicVariableAggregator } from './types'

export interface ChangeCountSample {
  first: any
  last: any
  count: number
}

function countChange(values: any[]) {
  if (values.length <= 1) {
    return 0
  }

  return values
    .slice(1)
    .reduce(
      (count, value, index) => (value !== values[index] ? count + 1 : count),
      0
    )
}

export const CHANGE_COUNT: LogicVariableAggregator<
  number,
  ChangeCountSample,
  number
> = {
  returnValueType: 'number',
  init: () => ({ first: null, last: null, count: 0 }),
  aggregate: (values) => ({
    first: values[0],
    last: values[values.length - 1],
    count: countChange(values),
  }),
  reduce: (aggregation, value) => ({
    first: aggregation.first,
    last: value[0],
    count: (() => {
      switch (
        aggregation.last !== value[0] &&
        aggregation.last !== null &&
        value[0] !== null
      ) {
        case true:
          return aggregation.count + 1
        case false:
          return aggregation.count
      }
    })(),
  }),
  merge: (aggregation1, aggregation2) => ({
    first: aggregation1.first,
    last: aggregation2.last,
    count: (() => {
      switch (
        aggregation1.last !== aggregation2.first &&
        aggregation1.last !== null &&
        aggregation2.first !== null
      ) {
        case true:
          return aggregation1.count + aggregation2.count + 1
        case false:
          return aggregation1.count + aggregation2.count
      }
    })(),
  }),
  compute: (aggregation) => aggregation.count,
}
