import { AVG } from './average'
import { COUNT } from './count'
import { SUM } from './sum'
import { RuleVariableAggregator } from './types'
import { RuleAggregationFunc } from '@/@types/openapi-internal/RuleAggregationFunc'

export function getRuleVariableAggregator(
  aggFunc: RuleAggregationFunc
): RuleVariableAggregator<any, any> {
  switch (aggFunc) {
    case 'COUNT':
      return COUNT
    case 'SUM':
      return SUM
    case 'AVG':
      return AVG
  }
}
