import { NUMBER_OF_ITEMS, NUMBER_OF_OBJECTS } from './number_of_items'
import { LOWERCASE, UPPERCASE } from './case-conversion'
import { LOCAL_TIME_IN_HOUR } from './local-time-in-hour'
import { TIMESTAMP_DIFF_SECONDS } from './timestamp-diff-seconds'
import { TRUNCATE_DECIMAL } from './truncate-decimals'
import { NUMBER_TO_STRING, STRING_TO_NUMBER } from './type-convertion'
import { LogicFunction } from './types'

const _LOGIC_FUNCTIONS: LogicFunction[] = [
  NUMBER_OF_ITEMS,
  NUMBER_OF_OBJECTS,
  TRUNCATE_DECIMAL,
  STRING_TO_NUMBER,
  NUMBER_TO_STRING,
  LOWERCASE,
  UPPERCASE,
  TIMESTAMP_DIFF_SECONDS,
]

export const INTERNAL_LOGIC_FUNCTIONS: LogicFunction[] = [LOCAL_TIME_IN_HOUR]

export const LOGIC_FUNCTIONS: LogicFunction[] = _LOGIC_FUNCTIONS.map(
  (func) => ({
    ...func,
    uiDefinition: {
      ...func.uiDefinition,
      jsonLogic: func.key,
    },
  })
)
