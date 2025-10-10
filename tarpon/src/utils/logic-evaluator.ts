import { ListService } from '@/services/list'

export function findListIds(logic: any): string[] {
  const listIds = new Set<string>()

  function traverse(obj: object) {
    if (!obj || typeof obj !== 'object') {
      return
    }

    if (Array.isArray(obj)) {
      obj.forEach((item) => traverse(item))
      return
    }

    const keys = Object.keys(obj)
    for (const key of keys) {
      if (key === 'op:inlist' || key === 'op:!inlist') {
        // The second element in the array contains the list IDs
        const [_, ids] = obj[key]
        ids.forEach((id) => listIds.add(id))
      } else {
        traverse(obj[key])
      }
    }
  }

  traverse(logic)
  return Array.from(listIds)
}

export async function resolveListNames(
  listService: ListService,
  listIds: Array<string>
): Promise<Map<string, string>> {
  const listNames = new Map<string, string>()
  await Promise.all(
    listIds.map(async (listId) => {
      const header = await listService.getListHeader(listId)
      const listName = header?.metadata?.name
      if (listName) {
        listNames.set(listId, listName)
      }
    })
  )
  return listNames
}
