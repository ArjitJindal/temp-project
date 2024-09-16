import { uniq } from 'lodash'
import { LogicVariableAggregator } from './types'

export const UNIQUE_VALUES: LogicVariableAggregator<
  string | number,
  Array<string | number>
> = {
  returnValueType: 'array',
  init: () => [],
  aggregate: (values) => uniq(values ?? []),
  reduce: (aggregation, value) => uniq((aggregation ?? []).concat(value)),
  merge: (aggregation1, aggregation2) =>
    uniq((aggregation1 ?? []).concat(aggregation2 ?? [])),
  compute: (aggregation) => aggregation ?? [],
}

export const UNIQUE_COUNT: LogicVariableAggregator<
  string | number,
  Array<string | number>,
  number
> = {
  ...UNIQUE_VALUES,
  returnValueType: 'number',
  compute: (aggregation) => (aggregation ?? []).length,
}
