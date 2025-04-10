import { isArray } from 'lodash'
import { TextLogicOperator } from './types'
import { getNegatedOperator } from './utils'
import { FUZZINESS_PARAMETER } from './similar-to-words'
import { logger } from '@/core/logger'
import { ListRepository } from '@/services/list/repositories/list-repository'
import { calculateLevenshteinDistancePercentage } from '@/utils/search'

export const SIMILAR_TO_LISTS_OPERATOR: TextLogicOperator = {
  key: 'op:similar_to_in_lists',
  uiDefinition: {
    label: 'Similar to (Lists)',
    valueTypes: ['text', 'number'],
    valueSources: ['value'],
  },
  parameters: [FUZZINESS_PARAMETER],
  run: async (value, rhs, parameters, context) => {
    if (!context) {
      logger.error('No context provided')
      return false
    }

    const fuzziness = parameters?.[0]
    const listIds = (isArray(rhs) ? rhs : [rhs]).filter(Boolean) as string[]

    if (!value) {
      return false
    }

    if (fuzziness == null) {
      logger.error('Fuzziness parameter is required for similar to operator')
      return false
    }

    const listRepo = new ListRepository(context.tenantId, context.dynamoDb)
    let key: string | undefined

    for (const listId of listIds) {
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const allListItems = await listRepo.getListItems(listId, {
          fromCursorKey: key,
        })
        key = allListItems.next

        for (const item of allListItems.items) {
          const levenshteinDistance = calculateLevenshteinDistancePercentage(
            item.key,
            value
          )

          if (levenshteinDistance >= fuzziness) {
            return true
          }
        }

        if (!allListItems.hasNext) {
          break
        }
      }
    }

    return false
  },
}

export const NOT_SIMILAR_TO_LISTS_OPERATOR = getNegatedOperator(
  SIMILAR_TO_LISTS_OPERATOR,
  'Not similar to (Lists)'
)
