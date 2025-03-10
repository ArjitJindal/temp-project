import { LogicFunction, LogicFunctionKey } from './types'
import dayjs from '@/utils/dayjs'

export const LOCAL_TIME_IN_HOUR: LogicFunction<number> = {
  key: LogicFunctionKey.LOCAL_TIME_IN_HOUR,
  group: 'number',
  uiDefinition: {
    label: 'local time in hour',
    returnType: 'number',
    args: {
      timestamp: {
        type: 'number',
        label: 'timestamp',
        valueSources: ['value', 'field', 'func'],
      },
      timezone: {
        type: 'string',
        label: 'timezone',
        valueSources: ['value', 'field', 'func'],
      },
    },
  },
  run: async ([timestamp, timezone]: any[]) => {
    return dayjs(timestamp).tz(timezone.split(' ')[0]).hour()
  },
}
