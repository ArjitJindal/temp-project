import { RuleAggregationVariable } from '@/@types/openapi-internal/RuleAggregationVariable'

export function createAggregationVariable(
  variable: Partial<RuleAggregationVariable>
): RuleAggregationVariable {
  return {
    key: 'agg:123',
    name: 'test-variable',
    type: 'USER_TRANSACTIONS',
    aggregationFieldKey: 'test-field-key',
    aggregationFunc: 'SUM',
    timeWindow: {
      start: { units: 1, granularity: 'day' },
      end: { units: 0, granularity: 'day' },
    },
    ...variable,
  } as RuleAggregationVariable
}
