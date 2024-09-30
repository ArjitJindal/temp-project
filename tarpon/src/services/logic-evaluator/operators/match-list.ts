import { isArray } from 'lodash'
import { TextLogicOperator } from './types'
import { getNegatedOperator } from './utils'
import { logger } from '@/core/logger'
import { ListRepository } from '@/services/list/repositories/list-repository'

export const MATCH_LIST_OPERATOR: TextLogicOperator = {
  key: 'op:inlist',
  uiDefinition: {
    label: 'Any in (Lists)',
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
    const result = await Promise.all(
      listIds.map(async (listId) => {
        const listHeader = await listRepo.getListHeader(listId)
        if (!listHeader?.metadata?.status) {
          return false
        }
        return listRepo.match(listHeader, value, 'EXACT')
      })
    )
    return result.some(Boolean)
  },
}
export const NOT_MATCHLIST_OPERATOR = getNegatedOperator(
  MATCH_LIST_OPERATOR,
  'Not in (Lists)'
)
