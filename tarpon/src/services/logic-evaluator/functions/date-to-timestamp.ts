import { LogicFunction, LogicFunctionKey } from './types'
import dayjs from '@/utils/dayjs'

export const DATE_TO_TIMESTAMP: LogicFunction<number> = {
  key: LogicFunctionKey.DATE_TO_TIMESTAMP,
  group: 'datetime',
  uiDefinition: {
    label: 'Date to Timestamp',
    returnType: 'datetime',
    args: {
      v1: {
        label: 'Date',
        type: 'text',
        valueSources: ['value', 'field', 'func'],
      },
    },
  },
  run: async ([date]: string[]) => {
    if (!date) {
      return 0
    }
    const dateRegex = /^(\d{4}-\d{2}-\d{2})$/
    if (!dateRegex.test(date)) {
      return NaN
    }
    return dayjs(date, 'YYYY-MM-DD').valueOf()
  },
}
