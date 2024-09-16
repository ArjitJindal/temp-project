import { sum } from 'lodash'
import { LogicVariableAggregator } from './types'

export const AVG: LogicVariableAggregator<
  number,
  { count: number; value: number },
  number
> = {
  returnValueType: 'number',
  init: () => ({ count: 0, value: 0 }),
  aggregate: (values) => ({ count: values.length, value: sum(values) }),
  reduce: (aggregation, value) => ({
    count: aggregation.count + 1,
    value: aggregation.value + value,
  }),
  merge: (aggregation1, aggregation2) => ({
    count: aggregation1.count + aggregation2.count,
    value: aggregation1.value + aggregation2.value,
  }),
  compute: (aggregation) => aggregation.value / aggregation.count,
}
