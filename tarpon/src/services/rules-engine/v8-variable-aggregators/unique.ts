import { uniq } from 'lodash'
import { RuleVariableAggregator } from './types'

export const UNIQUE_VALUES: RuleVariableAggregator<
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

export const UNIQUE_COUNT: RuleVariableAggregator<
  string | number,
  Array<string | number>,
  number
> = {
  ...UNIQUE_VALUES,
  returnValueType: 'number',
  compute: (aggregation) => (aggregation ?? []).length,
}
