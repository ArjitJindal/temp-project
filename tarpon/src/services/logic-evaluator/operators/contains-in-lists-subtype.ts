import isArray from 'lodash/isArray'
import { TextLogicOperator } from './types'
import { getNegatedOperator, checkValueContainsInList } from './utils'
import { ListRepository } from '@/services/list/repositories/list-repository'
import { logger } from '@/core/logger'

export const CONTAINS_IN_LISTS_SUBTYPE_OPERATOR: TextLogicOperator = {
  key: 'op:contains_in_lists_subtype',
  uiDefinition: {
    label: 'Contains (Lists Subtype)',
    valueTypes: ['text', 'multiselect'],
    valueSources: ['value'],
  },
  run: async (value, rhs, params, context) => {
    if (!context) {
      logger.error('No context provided')
      return false
    }
    const { subtype } = params
    if (!value) {
      return false
    }
    const listIds = (isArray(rhs) ? rhs : [rhs]).filter(Boolean) as string[]
    const listRepo = new ListRepository(context.tenantId, context.dynamoDb)
    const items = await Promise.all(
      listIds.map(async (listId) => {
        return checkValueContainsInList(
          value,
          listId,
          listRepo,
          async (listId) => {
            const listHeader = await listRepo.getListHeader(listId)
            return listHeader?.subtype === subtype
          }
        )
      })
    )
    return items.some(Boolean)
  },
}

export const NOT_CONTAINS_IN_LISTS_SUBTYPE_OPERATOR = getNegatedOperator(
  CONTAINS_IN_LISTS_SUBTYPE_OPERATOR,
  'Not contains (Lists Subtype)'
)
