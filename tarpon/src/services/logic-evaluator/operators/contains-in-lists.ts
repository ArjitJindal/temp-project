import { isArray } from 'lodash'
import { TextLogicOperator } from './types'
import { getNegatedOperator } from './utils'
import { ListRepository } from '@/services/list/repositories/list-repository'
import { logger } from '@/core/logger'

export const CONTAINS_IN_LISTS_OPERATOR: TextLogicOperator = {
  key: 'op:contains_in_lists',
  uiDefinition: {
    label: 'Contains (Lists)',
    valueTypes: ['text'],
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
    for (const listId of listIds) {
      const listHeader = await listRepo.getListHeader(listId)
      if (!listHeader?.metadata?.status) {
        continue
      }
      const result = await listRepo.match(listHeader, value, 'CONTAINS')
      if (result) {
        return true
      }
    }
    return false
  },
}

export const NOT_CONTAINS_IN_LISTS_OPERATOR = getNegatedOperator(
  CONTAINS_IN_LISTS_OPERATOR,
  'Not contains (Lists)'
)
