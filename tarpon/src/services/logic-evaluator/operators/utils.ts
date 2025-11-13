import { LogicOperator } from './types'
import { ListRepository } from '@/services/list/repositories/list-repository'

export function getNegatedOperator(
  operator: LogicOperator,
  label: string
): LogicOperator {
  return {
    ...operator,
    key: `op:!${operator.key.split('op:')[1]}` as any,
    uiDefinition: {
      ...operator.uiDefinition,
      label,
    },
    run: async (...args) => {
      const result = await operator.run(...args)
      return !result
    },
  }
}

export async function checkValueContainsInList(
  value: string,
  listId: string,
  listRepo: ListRepository,
  shouldProcessList?: (listId: string) => Promise<boolean>
): Promise<boolean> {
  if (shouldProcessList) {
    const shouldProcess = await shouldProcessList(listId)
    if (!shouldProcess) {
      return false
    }
  }

  let key: string | undefined
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const allListItems = await listRepo.getListItems(listId, {
      fromCursorKey: key,
      pageSize: 5000, // Fetching in pagination is very slow as compared to fetching all items at once
    })
    key = allListItems.next

    for (const item of allListItems.items) {
      if (value.includes(item.key)) {
        return true
      }
    }
    if (!allListItems.hasNext) {
      break
    }
  }
  return false
}
