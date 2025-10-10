import { LogicAggregationVariable } from '@/@types/openapi-internal/LogicAggregationVariable'

export function createAggregationVariable(
  variable: Partial<LogicAggregationVariable>
): LogicAggregationVariable {
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
    includeCurrentEntity: true,
    ...variable,
  } as LogicAggregationVariable
}
