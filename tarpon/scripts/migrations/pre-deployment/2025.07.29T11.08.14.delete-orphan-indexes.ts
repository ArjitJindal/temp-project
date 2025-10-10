import { migrateAllTenants } from '../utils/tenant'
import { Tenant } from '@/@types/tenant'
import {
  deleteIndex,
  getOpensearchClient,
  isOpensearchAvailableInRegion,
} from '@/utils/opensearch-utils'

let ran = false

async function migrateTenant(_tenant: Tenant) {
  if (!isOpensearchAvailableInRegion() || ran) {
    return
  }
  const client = await getOpensearchClient()
  const body = (await client.indices.getAlias())?.body
  const indexesToDelete = Object.entries(body)
    .filter(([index, { aliases }]) => {
      const aliasNames = Object.keys(aliases)
      return (
        aliasNames.every((alias) => !index.includes(alias)) ||
        !aliasNames?.length
      )
    })
    .map(([index]) => index)
  await Promise.all(indexesToDelete.map((index) => deleteIndex(client, index)))
  ran = true
}

export const up = async () => {
  await migrateAllTenants(migrateTenant)
}
export const down = async () => {
  // skip
}
