import { FLAGRIGHT_TENANT_ID } from '@/core/constants'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { ListRepository } from '@/services/list/repositories/list-repository'
import { FLAGRIGHT_LIST_LIBRARY } from '@/services/list/library'
import { generateChecksum } from '@/utils/object'
import { logger } from '@/core/logger'

async function deleteList(listId: string) {
  const dynamoDb = await getDynamoDbClient()
  const listRepository = new ListRepository(FLAGRIGHT_TENANT_ID, dynamoDb)
  let response = await listRepository.getListItems(listId)

  // eslint-disable-next-line no-constant-condition
  while (true) {
    for (const item of response.items) {
      await listRepository.deleteListItem(listId, item.key)
    }
    if (!response.next) {
      break
    }
    response = await listRepository.getListItems(listId, {
      fromCursorKey: response.next,
    })
  }
  await listRepository.deleteList(listId)
  console.info(`Deleted list '${listId}'.`)
}

export async function syncListLibrary() {
  const dynamoDb = await getDynamoDbClient()
  const listRepository = new ListRepository(FLAGRIGHT_TENANT_ID, dynamoDb)
  const lists = await listRepository.getListHeaders('FLAGRIGHT_LIBRARY')
  const listsToDelete = lists.filter(
    (list) => !FLAGRIGHT_LIST_LIBRARY.find((l) => l.id === list.listId)
  )

  for (const list of FLAGRIGHT_LIST_LIBRARY) {
    const checksum = generateChecksum(list)
    const existingList = lists.find((l) => l.listId === list.id)
    if (existingList?.metadata?.checksum === checksum) {
      console.info(`List '${list.id}' is not changed. Skip updating.`)
    } else {
      if (existingList?.metadata?.checksum) {
        console.info(
          `List '${list.id}' is changed. Deleting the existing list...`
        )
        await deleteList(list.id)
      }

      console.info(`Creating list '${list.id}'...`)
      await listRepository.createList(
        'FLAGRIGHT_LIBRARY',
        'STRING',
        {
          metadata: {
            name: list.name,
            description: list.description,
            status: true,
            checksum,
          },
          items: list.items,
        },
        list.id
      )
      console.info(`Created  list '${list.id}'.`)
    }
  }

  for (const listToDelete of listsToDelete) {
    console.info(`Deleting outdated list '${listToDelete.listId}'...`)
    await deleteList(listToDelete.listId)
  }
}

if (require.main === module) {
  void syncListLibrary()
    .then(() => process.exit(0))
    .catch((e) => {
      logger.error(e)
      process.exit(1)
    })
}
