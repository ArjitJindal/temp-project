import { LogicFunctionKey } from '../../services/logic-evaluator/functions/types'
import { LogicOperatorType } from '@/@types/openapi-internal/LogicOperatorType'

export type InternalJsonLogicOperator =
  | 'var'
  | 'missing'
  | 'missing_some'
  | 'if'
  | '=='
  | '==='
  | '!='
  | '!=='
  | '!'
  | '!!'
  | 'or'
  | 'and'
  | '>'
  | '>='
  | '<'
  | '<='
  | 'max'
  | 'min'
  | '+'
  | '-'
  | '*'
  | '/'
  | '%'
  | 'map'
  | 'reduce'
  | 'filter'
  | 'all'
  | 'none'
  | 'some'
  | 'merge'
  | 'in'
  | 'cat'
  | 'substr'
  | 'log'

export type AllJsonLogicOperators =
  | InternalJsonLogicOperator
  | LogicOperatorType
  | LogicFunctionKey

export type StaticallyDescriptionGenerator = Exclude<
  AllJsonLogicOperators,
  'and' | 'or' | 'var'
>
