import { MongoClient } from 'mongodb'
import { TenantRepository } from '../tenants/repositories/tenant-repository'
import { SanctionsDataProviders } from './types'
import { SanctionsDataProviderName } from '@/@types/openapi-internal/SanctionsDataProviderName'
import { SanctionsEntityType } from '@/@types/openapi-internal/SanctionsEntityType'
import { hasFeature } from '@/core/utils/context'
import { getDynamoDbClient } from '@/utils/dynamodb'
import {
  DELTA_SANCTIONS_COLLECTION,
  DELTA_SANCTIONS_GLOBAL_COLLECTION,
  SANCTIONS_COLLECTION,
  SANCTIONS_GLOBAL_COLLECTION,
  SANCTIONS_INDEX_DEFINITION,
  SANCTIONS_SEARCH_INDEX_DEFINITION,
} from '@/utils/mongodb-definitions'
import { Feature } from '@/@types/openapi-internal/Feature'
import { ACURIS_SANCTIONS_SEARCH_TYPES } from '@/@types/openapi-internal-custom/AcurisSanctionsSearchType'
import { OPEN_SANCTIONS_SEARCH_TYPES } from '@/@types/openapi-internal-custom/OpenSanctionsSearchType'
import { GenericSanctionsSearchType } from '@/@types/openapi-internal/GenericSanctionsSearchType'
import { DOW_JONES_SANCTIONS_SEARCH_TYPES } from '@/@types/openapi-internal-custom/DowJonesSanctionsSearchType'
import { SANCTIONS_SEARCH_TYPES } from '@/@types/openapi-internal-custom/SanctionsSearchType'
import { envIs } from '@/utils/env'
export const COLLECTIONS_MAP: {
  [key: string]: SanctionsEntityType[]
} = {
  [SanctionsDataProviders.ACURIS]: ['PERSON', 'BUSINESS'],
  [SanctionsDataProviders.OPEN_SANCTIONS]: ['PERSON', 'BUSINESS', 'BANK'],
}

export const DEFAULT_PROVIDER_TYEPS_MAP: {
  [key: string]: GenericSanctionsSearchType[]
} = {
  [SanctionsDataProviders.ACURIS]: ACURIS_SANCTIONS_SEARCH_TYPES,
  [SanctionsDataProviders.OPEN_SANCTIONS]: OPEN_SANCTIONS_SEARCH_TYPES,
  [SanctionsDataProviders.DOW_JONES]: DOW_JONES_SANCTIONS_SEARCH_TYPES,
  [SanctionsDataProviders.COMPLY_ADVANTAGE]: SANCTIONS_SEARCH_TYPES,
}

export const FEATURE_FLAG_PROVIDER_MAP: Record<
  string,
  SanctionsDataProviderName
> = {
  DOW_JONES: SanctionsDataProviders.DOW_JONES,
  OPEN_SANCTIONS: SanctionsDataProviders.OPEN_SANCTIONS,
  ACURIS: SanctionsDataProviders.ACURIS,
}

export function getDefaultProviders(): SanctionsDataProviderName[] {
  const providers: SanctionsDataProviderName[] = []
  if (hasFeature('DOW_JONES')) {
    providers.push(SanctionsDataProviders.DOW_JONES)
  }
  if (hasFeature('OPEN_SANCTIONS')) {
    providers.push(SanctionsDataProviders.OPEN_SANCTIONS)
  }
  if (hasFeature('ACURIS')) {
    providers.push(SanctionsDataProviders.ACURIS)
  }
  if (providers.length === 0 && hasFeature('SANCTIONS')) {
    providers.push(SanctionsDataProviders.COMPLY_ADVANTAGE)
  }
  return providers
}

export function isSanctionsDataFetchTenantSpecific(
  providers: SanctionsDataProviderName[]
): boolean {
  return providers.some((p) => !COLLECTIONS_MAP[p])
}

export function getTenantSpecificProviders(
  providers: SanctionsDataProviderName[]
): SanctionsDataProviderName[] {
  return providers.filter((p) => !COLLECTIONS_MAP[p])
}

export function getSanctionsCollectionName(
  providerInfo: {
    provider?: SanctionsDataProviderName
    entityType?: SanctionsEntityType
  },
  tenantId: string,
  type: 'delta' | 'full'
): string {
  const { provider } = providerInfo
  let { entityType } = providerInfo
  if (provider && COLLECTIONS_MAP[provider]) {
    if (
      provider === SanctionsDataProviders.ACURIS &&
      entityType &&
      entityType === 'BANK'
    ) {
      entityType = 'BUSINESS'
    }
    if (type === 'delta') {
      return DELTA_SANCTIONS_GLOBAL_COLLECTION()
    }
    if (entityType) {
      return SANCTIONS_GLOBAL_COLLECTION(provider, entityType)
    }
  }
  if (type === 'delta') {
    return DELTA_SANCTIONS_COLLECTION(tenantId)
  }
  return SANCTIONS_COLLECTION(tenantId)
}

function getAllGlobalSanctionsCollectionNames(
  providers: SanctionsDataProviderName[]
) {
  return [
    ...Object.entries(COLLECTIONS_MAP)
      .filter(([key]) => providers.includes(key as SanctionsDataProviderName))
      .flatMap(([key, value]) => {
        return value.map((v) => `sanctions-${key}-${v.toLowerCase()}`)
      }),
    ...(Object.keys(COLLECTIONS_MAP).some((key) =>
      providers.includes(key as SanctionsDataProviderName)
    )
      ? [DELTA_SANCTIONS_GLOBAL_COLLECTION()]
      : []),
  ]
}

export async function getTargetProviders(mongoClient: MongoClient) {
  const tenantIds = (await mongoClient.db().listCollections().toArray())
    .filter(
      ({ name }) =>
        !name.startsWith('migration') && name.endsWith('-transactions')
    )
    .map((collection) =>
      collection.name.slice(0, collection.name.lastIndexOf('-'))
    )
  const dynamoDb = getDynamoDbClient()
  const aggregatedFeatures = new Set<Feature>()
  for (const tenandId of tenantIds) {
    const tenantRepository = new TenantRepository(tenandId, { dynamoDb })
    const { features } = await tenantRepository.getTenantSettings(['features'])
    if (features) {
      features.map((f) => {
        aggregatedFeatures.add(f)
      })
    }
  }
  return [...aggregatedFeatures]
    .filter(
      (f) =>
        FEATURE_FLAG_PROVIDER_MAP[f] &&
        COLLECTIONS_MAP[FEATURE_FLAG_PROVIDER_MAP[f]]
    )
    .map((f) => FEATURE_FLAG_PROVIDER_MAP[f])
}

export async function getAllGlobalSanctionsCollectionDefinition(
  mongoClient: MongoClient
): Promise<{
  [collectionName: string]: {
    getIndexes: () => Array<{ index: { [key: string]: any }; unique?: boolean }>
    getSearchIndex?: () => Document
  }
}> {
  const providers = await getTargetProviders(mongoClient)
  const collectionNames = getAllGlobalSanctionsCollectionNames(providers)
  const definition = collectionNames.reduce((acc, c) => {
    acc[c] = {
      getIndexes: () => SANCTIONS_INDEX_DEFINITION,
      getSearchIndex: () =>
        SANCTIONS_SEARCH_INDEX_DEFINITION(c.includes('delta')),
    }
    return acc
  }, {})
  return definition
}

export function shouldBuildSearchIndexForUsers() {
  return (
    (hasFeature('ACURIS') ||
      hasFeature('DOW_JONES') ||
      hasFeature('OPEN_SANCTIONS')) &&
    envIs('prod')
  )
}
