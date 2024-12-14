import { Collection } from 'mongodb'
import { migrateAllTenants } from '../utils/tenant'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { TenantRepository } from '@/services/tenants/repositories/tenant-repository'
import { getMongoDbClient, processCursorInBatch } from '@/utils/mongodb-utils'
import { Tenant } from '@/services/accounts'
import { SANCTIONS_SEARCHES_COLLECTION } from '@/utils/mongodb-definitions'
import { generateChecksum } from '@/utils/object'
import { getSecretByName } from '@/utils/secrets-manager'
import { ComplyAdvantageApi } from '@/services/sanctions/providers/comply-advantage-api'
import { SanctionsSearchHistory } from '@/@types/openapi-internal/SanctionsSearchHistory'

async function migrateTenant(tenant: Tenant) {
  if (tenant.id !== '8e0e970c86' && tenant.id !== '78c5a44b9b') {
    //Run only for Fig
    return
  }
  const mongoDb = await getMongoDbClient()
  const tenantRepository = new TenantRepository(tenant.id, {
    mongoDb: mongoDb,
    dynamoDb: getDynamoDbClient(),
  })
  const { sanctions } = await tenantRepository.getTenantSettings()
  const customInitialSearchProfileId = sanctions?.customInitialSearchProfileId
  const db = mongoDb.db()
  const apiKey = (await getSecretByName('complyAdvantageCreds')).apiKey
  const complyAdvantageApi = new ComplyAdvantageApi(apiKey)
  const sanctionsSearchesCollection = db.collection<SanctionsSearchHistory>(
    SANCTIONS_SEARCHES_COLLECTION(tenant.id)
  )
  await processCursorInBatch(
    sanctionsSearchesCollection.find({}),
    async (sanctionsSearchs) => {
      await Promise.all(
        sanctionsSearchs.map(async (sanctionsSearch) => {
          return process(
            sanctionsSearch,
            customInitialSearchProfileId,
            sanctionsSearchesCollection,
            complyAdvantageApi
          )
        })
      )
    },
    {
      mongoBatchSize: 100,
      processBatchSize: 10,
      debug: true,
    }
  )
}

const process = async (
  sanctionsSearch: SanctionsSearchHistory,
  customInitialSearchProfileId: string | undefined,
  sanctionsSearchesCollection: Collection<SanctionsSearchHistory>,
  complyAdvantageApi: ComplyAdvantageApi
) => {
  const providerSearchId = sanctionsSearch.response?.providerSearchId
  if (providerSearchId) {
    const searchDetails = await complyAdvantageApi.getSearchDetails(
      providerSearchId
    )
    const searchProfileId =
      searchDetails.content?.data?.['search_profile']['slug']
    if (searchProfileId) {
      const providerConfigHash = generateChecksum({
        stage:
          searchProfileId === customInitialSearchProfileId
            ? 'INITIAL'
            : 'ONGOING',
      })
      await sanctionsSearchesCollection.updateOne(
        { _id: sanctionsSearch._id },
        { $set: { providerConfigHash } }
      )
    }
  }
}

export const up = async () => {
  await migrateAllTenants(migrateTenant)
}
export const down = async () => {
  // skip
}
