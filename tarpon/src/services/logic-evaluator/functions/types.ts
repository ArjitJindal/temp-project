import { Func } from '@react-awesome-query-builder/core'
import { LogicFunctionGroup } from '@/@types/openapi-internal/LogicFunctionGroup'

export enum LogicFunctionKey {
  NUMBER_OF_ITEMS = 'number_of_items',
  NUMBER_OF_OBJECTS = 'number_of_objects',
  LOCAL_TIME_IN_HOUR = 'local_time_in_hour',
  TIMESTAMP_DIFF_SECONDS = 'timestamp_diff_seconds',
  TRUNCATE_DECIMAL = 'truncate_decimal',
  STRING_TO_NUMBER = 'string_to_number',
  NUMBER_TO_STRING = 'number_to_string',
  LOWERCASE = 'lowercase',
  UPPERCASE = 'uppercase',
  DATE_TO_TIMESTAMP = 'date_to_timestamp',
}

export type LogicFunction<ReturnType = unknown> = {
  key: LogicFunctionKey
  uiDefinition: Omit<Func, 'jsonLogic'>
  group: LogicFunctionGroup
  run: (values: any[]) => Promise<ReturnType>
}
