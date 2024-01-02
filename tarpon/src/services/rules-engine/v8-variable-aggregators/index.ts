import { COUNT } from './count'
import { RuleVariableAggregator } from './types'
import { RuleAggregationFunc } from '@/@types/openapi-internal/RuleAggregationFunc'

export function getRuleVariableAggregator(
  aggFunc: RuleAggregationFunc
): RuleVariableAggregator<unknown, any> {
  switch (aggFunc) {
    case 'COUNT':
      return COUNT
    case 'SUM':
    case 'AVG':
      throw new Error('Unimplemented')
  }
}
