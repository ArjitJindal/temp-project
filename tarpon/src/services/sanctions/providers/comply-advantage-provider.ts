import { compact, groupBy, intersection, uniq } from 'lodash'
import {
  SanctionsDataProvider,
  SanctionsProviderResponse,
} from '@/services/sanctions/providers/types'
import { getSecretByName } from '@/utils/secrets-manager'
import { tenantSettings } from '@/core/utils/context'
import { logger } from '@/core/logger'
import {
  ComplyAdvantageApi,
  ComplyAdvantageEntity,
} from '@/services/sanctions/providers/comply-advantage-api'
import { ComplyAdvantageSearchHit } from '@/@types/openapi-internal/ComplyAdvantageSearchHit'
import { SanctionsSearchType } from '@/@types/openapi-internal/SanctionsSearchType'
import { envIs } from '@/utils/env'
import { SANCTIONS_SEARCH_TYPES } from '@/@types/openapi-internal-custom/SanctionsSearchType'
import { SanctionsSettingsMarketType } from '@/@types/openapi-internal/SanctionsSettingsMarketType'
import { SanctionsEntity } from '@/@types/openapi-internal/SanctionsEntity'
import { SanctionsSource } from '@/@types/openapi-internal/SanctionsSource'
import { notEmpty } from '@/utils/array'
import { ComplyAdvantageSearchHitDocFields } from '@/@types/openapi-internal/ComplyAdvantageSearchHitDocFields'
import { ComplyAdvantageSearchHitDoc } from '@/@types/openapi-internal/ComplyAdvantageSearchHitDoc'
import { SanctionsMatchTypeDetails } from '@/@types/openapi-internal/SanctionsMatchTypeDetails'
import { removeUndefinedFields } from '@/utils/object'
import { SanctionsSearchRequest } from '@/@types/openapi-internal/SanctionsSearchRequest'
import { SanctionsDataProviderName } from '@/@types/openapi-internal/SanctionsDataProviderName'
import { RuleStage } from '@/@types/openapi-internal/RuleStage'
import { traceable } from '@/core/xray'
import { SanctionsEntityType } from '@/@types/openapi-internal/SanctionsEntityType'
import { SanctionsEntityOtherSources } from '@/@types/openapi-internal/SanctionsEntityOtherSources'

function getSearchTypesKey(
  types: SanctionsSearchType[] = SANCTIONS_SEARCH_TYPES
) {
  const searchTypes = types.length ? types : SANCTIONS_SEARCH_TYPES
  return searchTypes.sort().reverse().join('-')
}

export function getSources(doc: ComplyAdvantageSearchHitDoc): {
  mediaSources?: SanctionsSource[]
  sanctionsSources?: SanctionsSource[]
  pepSources?: SanctionsSource[]
  otherSources?: SanctionsEntityOtherSources[]
} {
  if (!doc.sources) {
    return {}
  }

  // Group sources by categories
  const groups = doc.sources.reduce<{
    mediaSources: string[]
    sanctionsSources: string[]
    pepSources: string[]
    warningsSources: string[]
  }>(
    (groups, source) => {
      const amlTypes = (doc.source_notes[source]?.aml_types as string[]) || []

      if (amlTypes.some((type) => type.includes('adverse-media'))) {
        groups.mediaSources.push(source)
      }

      if (amlTypes.some((type) => type.includes('pep'))) {
        groups.pepSources.push(source)
      }

      if (amlTypes.some((type) => type.includes('sanctions'))) {
        groups.sanctionsSources.push(source)
      }

      if (amlTypes.some((type) => type.includes('warning'))) {
        groups.warningsSources.push(source)
      }

      return groups
    },
    {
      mediaSources: [],
      pepSources: [],
      sanctionsSources: [],
      warningsSources: [],
    }
  )

  // Helper function to map sources to required format
  const mapSource = (source: string, includeMedia = false): SanctionsSource => {
    const sourceNotes = doc.source_notes[source]
    const fields = doc.fields?.filter((f) => f.source === source) || []
    const groupedFields = Object.values(
      fields.reduce((acc, item) => {
        if (item.name && item.value) {
          if (!acc[item.name]) {
            acc[item.name] = { name: item.name, values: [item.value] }
          } else {
            acc[item.name].values.push(item.value)
          }
        }
        return acc
      }, {} as Record<string, { name: string; values: string[] }>)
    )

    const base: SanctionsSource = {
      name: sourceNotes?.name,
      url: sourceNotes?.url,
      countryCodes: sourceNotes?.country_codes,
      fields: groupedFields,
      createdAt: sourceNotes?.listing_started_utc,
      endedAt: sourceNotes?.listing_ended_utc,
    }

    return includeMedia ? { ...base, media: doc.media } : base
  }

  return {
    mediaSources: groups.mediaSources.map((source) => mapSource(source, true)),
    pepSources: groups.pepSources.map((source) => mapSource(source)),
    sanctionsSources: groups.sanctionsSources.map((source) =>
      mapSource(source)
    ),
    otherSources: [
      {
        type: 'WARNINGS',
        value: groups.warningsSources.map((source) => mapSource(source)),
      },
    ],
  }
}

export function complyAdvantageDocToEntity(
  hit: ComplyAdvantageSearchHit
): SanctionsEntity {
  const doc = hit.doc
  const fieldData = extractInformationFromFields(hit.doc.fields ?? [])
  const sources = getSources(doc)
  const sanctionSearchTypes = compact(
    uniq(
      hit.match_types_details?.flatMap((mt) =>
        mt.aml_types?.map((t) =>
          t.includes('media')
            ? 'ADVERSE_MEDIA'
            : t.includes('pep')
            ? 'PEP'
            : t.includes('warning')
            ? 'WARNINGS'
            : 'SANCTIONS'
        )
      )
    )
  )

  const sanctionsEntity: SanctionsEntity = {
    id: doc.id as string,
    name: doc.name as string,
    countries: fieldData['Country']?.values.map((v) => v.value) ?? [],
    types: doc.types,
    matchTypes: hit.match_types,
    sanctionSearchTypes,
    aka: doc.aka?.map((aka) => aka.name).filter(Boolean) as string[],
    entityType: doc.entity_type as SanctionsEntityType,
    updatedAt: doc.last_updated_utc
      ? new Date(doc.last_updated_utc).getTime()
      : undefined,
    yearOfBirth: fieldData['Year of Birth']?.values.map((value) => value.value),
    gender: fieldData['Gender']?.values[0]?.value as string,
    matchTypeDetails:
      hit.match_types_details?.map(
        (mtd): SanctionsMatchTypeDetails => ({
          nameMatches: mtd.name_matches,
          secondaryMatches: mtd.secondary_matches,
          sources: mtd.sources || [],
          matchingName: mtd.matching_name,
          amlTypes: mtd.aml_types,
        })
      ) || [],
    nameMatched:
      hit.match_types_details?.some((x) => (x.name_matches?.length ?? 0) > 0) ??
      false,
    dateMatched:
      hit.match_types_details?.some(
        (x) => (x.secondary_matches?.length ?? 0) > 0
      ) ?? false,
    associates:
      doc.associates?.map((a) => ({ name: a.name, association: a.name })) ?? [],
    ...sources,
    rawResponse: hit,
  }
  return removeUndefinedFields(sanctionsEntity)
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
  [getSearchTypesKey(['SANCTIONS', 'PEP', 'ADVERSE_MEDIA', 'WARNINGS'])]:
    'fda44006-9e6b-4028-8f4b-d13b0d1fa122',
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
      [getSearchTypesKey(['SANCTIONS', 'PEP', 'ADVERSE_MEDIA', 'WARNINGS'])]:
        '5a4c7e72-2aa0-4238-ad82-27c1f797f96e',
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
      [getSearchTypesKey(['SANCTIONS', 'PEP', 'ADVERSE_MEDIA', 'WARNINGS'])]:
        '5a4c7e72-2aa0-4238-ad82-27c1f797f96e',
    },
  },
  sandbox: {
    EMERGING: SANDBOX_PROFILES,
    FIRST_WORLD: SANDBOX_PROFILES,
  },
}

@traceable
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

  static async build(tenantId: string, stage?: RuleStage) {
    const settings = await tenantSettings(tenantId)
    let complyAdvantageSearchProfileId =
      settings.sanctions?.customSearchProfileId

    if (
      settings.sanctions?.customInitialSearchProfileId &&
      stage === 'INITIAL'
    ) {
      complyAdvantageSearchProfileId =
        settings.sanctions?.customInitialSearchProfileId
    }
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
    request: SanctionsSearchRequest
  ): Promise<SanctionsProviderResponse> {
    const searchTypes = intersection(
      request.types || [],
      SANCTIONS_SEARCH_TYPES
    ) as SanctionsSearchType[]
    const searchProfileId =
      this.complyAdvantageSearchProfileId ||
      this.pickSearchProfileId(searchTypes) ||
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
    const caSearchId = `${response.content?.data?.id}`
    const caSearchRef = response.content?.data?.ref
    if (hits != null && caSearchRef) {
      const restHits = await this.fetchAllHits(caSearchRef, 2)
      hits = [...hits, ...restHits]
    }
    const createdAt = response.content.data?.created_at
    return {
      data: hits?.map(complyAdvantageDocToEntity) || [],
      hitsCount: hits?.length || 0,
      providerSearchId: caSearchId,
      request,
      createdAt: createdAt
        ? new Date(createdAt).getTime()
        : new Date().getTime(),
    }
  }

  async getSearch(
    providerSearchId: string
  ): Promise<SanctionsProviderResponse> {
    const result = await this.complyAdvantageApi.getSearchDetails(
      providerSearchId
    )
    const createdAt = result.content?.data?.created_at

    return {
      providerSearchId: `${result.content?.data?.id}`,
      data: result.content?.data?.hits?.map(complyAdvantageDocToEntity) || [],
      hitsCount: result.content?.data?.hits?.length || 0,
      createdAt: createdAt
        ? new Date(createdAt).getTime()
        : new Date().getTime(),
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
        const newHits =
          entities.content?.map(convertComplyAdvantageEntityToHit) ?? []
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

export function convertComplyAdvantageEntityToHit(
  entity: ComplyAdvantageEntity
): ComplyAdvantageSearchHit {
  return {
    doc: {
      id: entity.id,
      aka: entity.key_information?.aka,
      entity_type: entity.key_information?.entity_type,
      fields: Object.values(entity.full_listing ?? {}).flatMap((items) =>
        Object.values(items ?? {}).flatMap((item) => item?.data ?? [])
      ),
      keywords: entity.uncategorized?.keywords,
      last_updated_utc: entity.last_updated_utc
        ? new Date(entity.last_updated_utc)
        : undefined,
      media: entity.uncategorized?.media,
      name: entity.key_information?.name,
      source_notes: entity.key_information?.source_notes,
      sources: entity.key_information?.sources,
      types: entity.key_information?.types,
    },
    match_types: entity.key_information?.match_types,
  }
}

function extractInformationFromFields(
  allFields: ComplyAdvantageSearchHitDocFields[]
): {
  [name: string]: {
    values: {
      value: string
      sources: string[]
    }[]
  }
} {
  return Object.fromEntries(
    Object.entries(groupBy(allFields, 'name')).map(([name, fields]) => [
      name,
      {
        values: Object.entries(groupBy(fields, 'value')).map(
          ([value, fields]) => ({
            value,
            sources: fields.map(({ source }) => source).filter(notEmpty),
          })
        ),
      },
    ])
  )
}
