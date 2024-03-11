import { RuleOperator } from './types'
import { getNegatedOperator } from './utils'
import { logger } from '@/core/logger'
import { ListRepository } from '@/services/list/repositories/list-repository'

export const MATCH_LIST_OPERATOR: RuleOperator<string, string[]> = {
  key: 'op:inlist',
  uiDefinition: {
    label: 'Any in (Lists)',
    valueTypes: ['text'],
    valueSources: ['value'],
  },
  run: async (value, listIds, _params, context) => {
    if (!context) {
      logger.error('No context provided')
      return false
    }
    const listRepo = new ListRepository(context.tenantId, context.dynamoDb)
    const result = await Promise.all(
      listIds.map(async (listId) => {
        const listHeader = await listRepo.getListHeader(listId)
        if (!listHeader?.metadata?.status) {
          return false
        }
        return listRepo.match(listId, value, 'EXACT')
      })
    )
    return result.some(Boolean)
  },
}
export const NOT_MATCHLIST_OPERATOR = getNegatedOperator(
  MATCH_LIST_OPERATOR,
  'Not in (Lists)'
)
