import { JSONSchemaType } from 'ajv'
import { LogicOperator } from './types'
import dayjs from '@/utils/dayjs'
import { logger } from '@/core/logger'

export const DURATION_PARAMETER: JSONSchemaType<any> = {
  title: 'Duration',
  description: 'Duration in seconds between timestamps',
  type: 'number',
}

export const getTimeDifferenceComparisonOperator = (
  greater: boolean,
  key: 'op:time_difference_greater_than' | 'op:time_difference_lesser_than'
): LogicOperator<number> => ({
  key: key,
  uiDefinition: {
    valueTypes: ['datetime'],
    valueSources: ['value', 'func', 'field'],
    label: `Time difference ${greater ? 'greater than' : 'lesser than'}`,
  },
  parameters: [DURATION_PARAMETER],
  run: async (lhs, rhs, parameters) => {
    const threshold = parameters[0]

    if (!Number.isFinite(lhs) || !Number.isFinite(rhs)) {
      logger.warn('Invalid timestamps: both timestamps must be finite numbers')
      return false
    }

    if (!Number.isFinite(threshold)) {
      logger.warn('Invalid threshold parameter: must be a finite number')
      return false
    }

    const timeDifference = Math.abs(dayjs(lhs).diff(dayjs(rhs), 'seconds'))
    return greater ? timeDifference > threshold : timeDifference < threshold
  },
})

export const TIME_DIFFERENCE_GREATER_THAN = getTimeDifferenceComparisonOperator(
  true,
  'op:time_difference_greater_than'
)
export const TIME_DIFFERENCE_LESSER_THAN = getTimeDifferenceComparisonOperator(
  false,
  'op:time_difference_lesser_than'
)
