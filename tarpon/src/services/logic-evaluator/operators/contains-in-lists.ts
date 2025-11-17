import isArray from 'lodash/isArray'
import { TextLogicOperator } from './types'
import { getNegatedOperator, checkValueContainsInList } from './utils'
import { ListRepository } from '@/services/list/repositories/list-repository'
import { logger } from '@/core/logger'

export const CONTAINS_IN_LISTS_OPERATOR: TextLogicOperator = {
  key: 'op:contains_in_lists',
  uiDefinition: {
    label: 'Contains (Lists)',
    valueTypes: ['text', 'multiselect'],
    valueSources: ['value'],
  },
  run: async (value, rhs, _params, context) => {
    if (!context) {
      logger.error('No context provided')
      return false
    }

    if (!value) {
      return false
    }
    const listIds = (isArray(rhs) ? rhs : [rhs]).filter(Boolean) as string[]
    const listRepo = new ListRepository(context.tenantId, context.dynamoDb)
    const items = await Promise.all(
      listIds.map(async (listId) => {
        return checkValueContainsInList(value, listId, listRepo)
      })
    )
    return items.some(Boolean)
  },
}

export const NOT_CONTAINS_IN_LISTS_OPERATOR = getNegatedOperator(
  CONTAINS_IN_LISTS_OPERATOR,
  'Not contains (Lists)'
)
