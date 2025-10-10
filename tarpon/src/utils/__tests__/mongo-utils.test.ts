import join from 'lodash/join'
import split from 'lodash/split'
import { allCollections, getMongoDbClient } from '../mongodb-utils'
import { getTestTenantId } from '@/test-utils/tenant-test-utils'

describe('Test mongo all collections', () => {
  const TENANT_ID = join(split(getTestTenantId(), '-'), '_')
  const TENANT_ID_2 = `${TENANT_ID}suffix`

  test('should return all collections', async () => {
    const mongoDb = await getMongoDbClient()
    const db = mongoDb.db()
    await db.createCollection(`${TENANT_ID}-accounts`)
    await db.createCollection(`${TENANT_ID}-transactions`)
    await db.createCollection(`${TENANT_ID}-test-transactions`)
    await db.createCollection(`${TENANT_ID}-users`)
    await db.createCollection(`${TENANT_ID_2}-accounts`)
    await db.createCollection(`${TENANT_ID_2}-transactions`)
    await db.createCollection(`${TENANT_ID_2}-test-transactions`)
    await db.createCollection(`${TENANT_ID_2}-users`)

    const collections = await allCollections(TENANT_ID, db)

    expect(collections.sort()).toEqual([
      `${TENANT_ID}-accounts`,
      `${TENANT_ID}-test-transactions`,
      `${TENANT_ID}-transactions`,
      `${TENANT_ID}-users`,
    ])
  })
})
