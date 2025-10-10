import isArray from 'lodash/isArray'
import { TextLogicOperator } from './types'
import { getNegatedOperator } from './utils'
import { logger } from '@/core/logger'
import { ListRepository } from '@/services/list/repositories/list-repository'

export const MATCH_LIST_OPERATOR: TextLogicOperator = {
  key: 'op:inlist',
  uiDefinition: {
    label: 'Any in (Lists)',
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
    const result = await Promise.all(
      listIds.map(async (listId) => {
        const listHeader = await listRepo.getListHeader(listId)
        if (!listHeader?.metadata?.status) {
          return false
        }
        if (isArray(value)) {
          const matchResults = await Promise.all(
            value.map((val) => listRepo.match(listHeader, val, 'EXACT'))
          )
          return matchResults.some(Boolean)
        } else {
          return listRepo.match(listHeader, value, 'EXACT')
        }
      })
    )
    return result.some(Boolean)
  },
}
export const NOT_MATCHLIST_OPERATOR = getNegatedOperator(
  MATCH_LIST_OPERATOR,
  'Not in (Lists)'
)
