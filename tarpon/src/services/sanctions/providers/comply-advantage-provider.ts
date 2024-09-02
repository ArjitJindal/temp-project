import {
  SanctionsDataProvider,
  SanctionsDataProviderName,
  SanctionsProviderResponse,
  SanctionsProviderSearchRequest,
} from '@/services/sanctions/providers/types'
import { getSecretByName } from '@/utils/secrets-manager'
import { tenantSettings } from '@/core/utils/context'
import { logger } from '@/core/logger'
import { ComplyAdvantageApi } from '@/services/sanctions/providers/comply-advantage-api'
import { ComplyAdvantageSearchHit } from '@/@types/openapi-internal/ComplyAdvantageSearchHit'
import { SanctionsSearchType } from '@/@types/openapi-internal/SanctionsSearchType'
import { envIs } from '@/utils/env'
import { SANCTIONS_SEARCH_TYPES } from '@/@types/openapi-internal-custom/SanctionsSearchType'
import { SanctionsSettingsMarketType } from '@/@types/openapi-internal/SanctionsSettingsMarketType'
import { convertEntityToHit } from '@/services/sanctions'

function getSearchTypesKey(
  types: SanctionsSearchType[] = SANCTIONS_SEARCH_TYPES
) {
  const searchTypes = types.length ? types : SANCTIONS_SEARCH_TYPES
  return searchTypes.sort().reverse().join('-')
}

const SANDBOX_PROFILES = {
  [getSearchTypesKey(['SANCTIONS'])]: 'b5d54657-4370-45a2-acdd-a40956e02ef4',
  [getSearchTypesKey(['SANCTIONS', 'PEP'])]:
    '65032c2f-d579-4ef6-8464-c8fbe9df11bb',
  [getSearchTypesKey(['SANCTIONS', 'ADVERSE_MEDIA'])]:
    '12517f27-42d7-4d43-85c4-b28835d284c7',
  [getSearchTypesKey(['PEP'])]: '9d9036f4-89c5-4e60-880a-3c5aacfbe3ed',
  [getSearchTypesKey(['PEP', 'ADVERSE_MEDIA'])]:
    '2fd847d0-a49b-4321-b0d8-6c42fa64c040',
  [getSearchTypesKey(['ADVERSE_MEDIA'])]:
    '1e99cb5e-36d2-422b-be1f-0024999b92b7',
  [getSearchTypesKey(['SANCTIONS', 'PEP', 'ADVERSE_MEDIA'])]:
    'd563b827-7baa-4a0c-a2ae-7e38e5051cf2',
}
const SEARCH_PROFILE_IDS: Record<
  'prod' | 'sandbox',
  Record<SanctionsSettingsMarketType, { [key: string]: string }>
> = {
  prod: {
    EMERGING: {
      [getSearchTypesKey(['SANCTIONS'])]:
        '01c3b373-c01a-48b2-96f7-3fcf17dd0c91',
      [getSearchTypesKey(['SANCTIONS', 'PEP'])]:
        '8b51ca9d-4b45-4de7-bac8-3bebcf6041ab',
      [getSearchTypesKey(['SANCTIONS', 'ADVERSE_MEDIA'])]:
        '919d1abb-2add-46c1-b73a-0fbae79aee6d',
      [getSearchTypesKey(['PEP'])]: 'a9b22101-e5d5-477c-b2c7-2f875ebbd5d8',
      [getSearchTypesKey(['PEP', 'ADVERSE_MEDIA'])]:
        'e04c41ad-d3f0-4562-9b51-9d00a8965f16',
      [getSearchTypesKey(['ADVERSE_MEDIA'])]:
        '5a67aa5f-4ec8-4a61-af3a-78e3c132a24d',
      [getSearchTypesKey(['SANCTIONS', 'PEP', 'ADVERSE_MEDIA'])]:
        '15cb1d65-7f06-4eb3-84f5-f0cb9f1d4c8f',
    },
    FIRST_WORLD: {
      [getSearchTypesKey(['SANCTIONS'])]:
        '9abd440a-a746-4308-8b9d-219d7093990c',
      [getSearchTypesKey(['SANCTIONS', 'PEP'])]:
        '77220fe4-892c-4e13-b57f-379a437ec521',
      [getSearchTypesKey(['SANCTIONS', 'ADVERSE_MEDIA'])]:
        '230ede36-a63e-414d-b343-97b2ff375a7c',
      [getSearchTypesKey(['PEP'])]: '17bdb7e6-1e97-4972-9dfb-56650b1f7d83',
      [getSearchTypesKey(['PEP', 'ADVERSE_MEDIA'])]:
        '4f4d18a4-f8b7-457e-a4a1-a9d3e5fa009c',
      [getSearchTypesKey(['ADVERSE_MEDIA'])]:
        'f1f5c970-991e-4c68-856b-1f4cfd790968',
      [getSearchTypesKey(['SANCTIONS', 'PEP', 'ADVERSE_MEDIA'])]:
        'a8eea736-c654-48a3-97d9-62ea43ef3031',
    },
  },
  sandbox: {
    EMERGING: SANDBOX_PROFILES,
    FIRST_WORLD: SANDBOX_PROFILES,
  },
}

export class ComplyAdvantageDataProvider implements SanctionsDataProvider {
  private complyAdvantageMarketType: string
  private complyAdvantageApi: ComplyAdvantageApi
  private complyAdvantageSearchProfileId: string

  constructor(
    complyAdvantageMarketType: string,
    apiKey: string,
    complyAdvantageSearchProfileId: string
  ) {
    this.complyAdvantageMarketType = complyAdvantageMarketType
    this.complyAdvantageApi = new ComplyAdvantageApi(apiKey)
    this.complyAdvantageSearchProfileId = complyAdvantageSearchProfileId
  }

  static async build(tenantId) {
    const settings = await tenantSettings(tenantId)
    const complyAdvantageSearchProfileId =
      settings.sanctions?.customSearchProfileId
    if (!settings.sanctions?.marketType) {
      logger.error('Tenant market type is not set')
    }

    return new ComplyAdvantageDataProvider(
      settings.sanctions?.marketType || 'FIRST_WORLD',
      await this.getApiKey(),
      complyAdvantageSearchProfileId || ''
    )
  }

  provider(): SanctionsDataProviderName {
    return 'comply-advantage'
  }

  async search(
    request: SanctionsProviderSearchRequest
  ): Promise<SanctionsProviderResponse> {
    const searchProfileId =
      this.complyAdvantageSearchProfileId ||
      this.pickSearchProfileId(request.types) ||
      (process.env.COMPLYADVANTAGE_DEFAULT_SEARCH_PROFILE_ID as string)

    const response = await this.complyAdvantageApi.postSearch(searchProfileId, {
      searchTerm: request.searchTerm,
      fuzziness: request.fuzziness,
      countryCodes: request.countryCodes,
      yearOfBirth: request.yearOfBirth,
    })

    let hits = response.content?.data?.hits

    if (response.content?.data?.id == null) {
      throw new Error(`Unable to get search ref from CA raw response`)
    }
    const caSearchRef = `${response.content?.data?.id}`
    if (hits != null) {
      const restHits = await this.fetchAllHits(caSearchRef, 2)
      hits = [...hits, ...restHits]
    }
    return {
      data: hits,
      hitsCount: hits?.length || 0,
      providerSearchId: caSearchRef,
    }
  }

  async getSearch(
    providerSearchId: string
  ): Promise<SanctionsProviderResponse> {
    const result = await this.complyAdvantageApi.getSearchDetails(
      providerSearchId
    )
    return {
      providerSearchId: `${result.content?.data?.id}`,
      data: result.content?.data?.hits || [],
      hitsCount: result.content?.data?.hits?.length || 0,
    }
  }

  async deleteSearch(providerSearchId: string): Promise<void> {
    await this.complyAdvantageApi.deleteSearch(providerSearchId)
  }

  async setMonitoring(
    providerSearchId: string,
    monitor: boolean
  ): Promise<void> {
    await this.complyAdvantageApi.patchMonitors(providerSearchId, {
      enabled: monitor,
    })
  }

  private async fetchAllHits(
    searchRef: string,
    startPage: number = 1
  ): Promise<ComplyAdvantageSearchHit[]> {
    const hits: ComplyAdvantageSearchHit[] = []
    if (searchRef != null) {
      let page = startPage
      do {
        const entities = await this.complyAdvantageApi.getSearchEntities(
          searchRef,
          {
            page,
          }
        )
        page++
        const newHits = entities.content?.map(convertEntityToHit) ?? []
        hits.push(...newHits)
        if (newHits.length === 0) {
          break
        }
      } while (page < 100)
    }
    return hits
  }

  private static async getApiKey(): Promise<string> {
    if (process.env.COMPLYADVANTAGE_API_KEY) {
      return process.env.COMPLYADVANTAGE_API_KEY
    }
    return (await getSecretByName('complyAdvantageCreds')).apiKey
  }

  private pickSearchProfileId(types: SanctionsSearchType[] = []) {
    const profiles =
      SEARCH_PROFILE_IDS[envIs('prod') ? 'prod' : 'sandbox'][
        this.complyAdvantageMarketType ?? 'EMERGING'
      ]
    const key = getSearchTypesKey(types)
    const profileId = profiles[key]

    if (!profileId) {
      logger.error(`Cannot find search profile for types ${types}`)
    }

    return profileId
  }
}
