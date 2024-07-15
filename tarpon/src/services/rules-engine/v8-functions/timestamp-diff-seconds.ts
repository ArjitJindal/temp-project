import { RuleFunction } from './types'
import dayjs from '@/utils/dayjs'

export const TIMESTAMP_DIFF_SECONDS: RuleFunction<number> = {
  key: 'timestamp_diff_seconds',
  group: 'datetime',
  uiDefinition: {
    label: 'Time difference (seconds)',
    returnType: 'number',
    args: {
      v1: {
        label: 'Time 1',
        type: 'datetime',
        valueSources: ['value', 'field', 'func'],
      },
      v2: {
        label: 'Time 2',
        type: 'datetime',
        valueSources: ['value', 'field', 'func'],
      },
    },
  },
  run: async ([t1, t2]: number[]) => {
    if (!Number.isFinite(t1) || !Number.isFinite(t2)) {
      return NaN
    }
    return Math.abs(dayjs(t1).diff(dayjs(t2), 'second'))
  },
}
