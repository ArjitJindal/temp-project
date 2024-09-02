import { apiFetch, ApiFetchResult } from '@/utils/api-fetch'
import { ComplyAdvantageSearchHit } from '@/@types/openapi-internal/ComplyAdvantageSearchHit'
import { ComplyAdvantageMatchType } from '@/@types/openapi-internal/ComplyAdvantageMatchType'
import { logger } from '@/core/logger'
import { ComplyAdvantageSearchResponseContent } from '@/@types/openapi-internal/ComplyAdvantageSearchResponseContent'

const COMPLY_ADVANTAGE_ROOT_URL = 'https://api.complyadvantage.com'

export interface ComplyAdvantageAssignee {
  id?: number
  email?: string
  name?: string
  phone?: string
  created_at?: string
  user_is_active?: boolean
}

export type ComplyAdvantageSearchItem = {
  id?: number
  ref?: string
  searcher_id?: number
  assignee_id?: number
  filters?: {
    types?: Array<string>
    country_codes?: Array<string>
    birth_year?: number
    entity_type?: string
    remove_deceased?: number
    exact_match?: boolean
    fuzziness?: number
  }
  match_status?: string
  risk_level?: string
  search_term?: string
  submitted_term?: string
  client_ref?: string
  total_hits?: number
  updated_at?: string
  created_at?: string
  tags?: Array<string>
  labels?: Array<string>
  total_matches?: number
  limit?: number
  offset?: number
  share_url?: string
  searcher?: ComplyAdvantageAssignee
  assignee?: ComplyAdvantageAssignee
  hits?: Array<ComplyAdvantageSearchHit>
}

export interface ComplyAdvantageEntity {
  id: string
  last_updated_utc?: string
  created_utc?: string
  key_information?: ComplyAdvantageEntityKeyInformation
  uncategorized?: ComplyAdvantageEntityUncategorized
  full_listing?: {
    [type: string]:
      | {
          [name: string]: ComplyAdvantageEntityListingItem | undefined
        }
      | undefined
  }
  navigation?: {
    next: unknown
    previous: unknown
  }
}

export interface ComplyAdvantageEntityKeyInformation {
  name: string
  entity_type: string
  types: string[]
  grouped_types: {
    type: string
  }[]
  match_types: ComplyAdvantageMatchType[]
  sources: string[]
  source_notes: {
    [key: string]: ComplyAdvantageEntitySourceNotesItem | undefined
  }
  aka: {
    name: string
  }[]
  date_of_birth: string
  dates_of_birth: string[]
  match_status: string
  risk_level: unknown
  is_whitelisted: boolean
  age: number
  death_age: unknown
  date_of_death: unknown
  primary_country: unknown
  country_names: string
  designation: string
  associates: {
    association: string
    name: string
  }[]
}

export interface ComplyAdvantageEntitySourceNotesItem {
  aml_types: string[]
  country_codes: string[]
  listing_started_utc: string
  name: string
  url: string
}

export interface ComplyAdvantageEntityUncategorized {
  keywords: string[]
  media: {
    snippet?: string
    title?: string
    url?: string
  }[]
  assets: {
    public_url: string
    source: string
    type: string
    url: string
  }[]
  match_types: string[]
  related: unknown[]
  fields: unknown[]
}

export interface ComplyAdvantageEntityListingItem {
  name?: string
  source?: string
  url?: string
  country_codes?: string[]
  aml_types?: string[]
  count?: number
  disclose_sources?: boolean
  data?: {
    name: string
    source: string
    value: string
    tag?: string
  }[]
  listing_started_utc?: string
  listing_ended_utc?: unknown
}

export interface ComplyAdvantageResponseSuccess<T> {
  code: number
  status: 'success'
  content?: T
}

export interface ComplyAdvantageResponseFailure {
  code: number
  status: 'failure'
  content?: {
    message?: string
  }
}

export type ComplyAdvantageResponse<T> =
  | ComplyAdvantageResponseSuccess<T>
  | ComplyAdvantageResponseFailure

export class ComplyAdvantageApi {
  private apiKey: string

  constructor(apiKey: string) {
    this.apiKey = apiKey
  }

  async postSearch(
    searchProfileId: string,
    request: {
      searchTerm: string
      fuzziness?: number
      countryCodes?: Array<string>
      yearOfBirth?: number
    }
  ): Promise<
    ComplyAdvantageResponseSuccess<ComplyAdvantageSearchResponseContent>
  > {
    const rawComplyAdvantageResponse = await apiFetch<
      ComplyAdvantageResponse<ComplyAdvantageSearchResponseContent>
    >(`${COMPLY_ADVANTAGE_ROOT_URL}/searches`, {
      method: 'POST',
      body: JSON.stringify({
        search_term: request.searchTerm,
        fuzziness: request.fuzziness,
        search_profile: searchProfileId,
        filters: {
          country_codes: request.countryCodes,
          birth_year: request.yearOfBirth,
        },
      }),
      headers: {
        Authorization: `Token ${this.apiKey}`,
      },
    })

    return this.unwrapResult(rawComplyAdvantageResponse)
  }

  async getSearchDetails(
    searchId: string
  ): Promise<
    ComplyAdvantageResponseSuccess<ComplyAdvantageSearchResponseContent>
  > {
    const rawComplyAdvantageResponse = await apiFetch<
      ComplyAdvantageResponse<ComplyAdvantageSearchResponseContent>
    >(`${COMPLY_ADVANTAGE_ROOT_URL}/searches/${searchId}/details`, {
      method: 'GET',
      headers: {
        Authorization: `Token ${this.apiKey}`,
      },
    })

    return this.unwrapResult(rawComplyAdvantageResponse)
  }

  async deleteSearch(caSearchId: string): Promise<void> {
    const response = await apiFetch<ComplyAdvantageResponse<unknown>>(
      `${COMPLY_ADVANTAGE_ROOT_URL}/searches/${caSearchId}`,
      {
        method: 'DELETE',
        headers: {
          Authorization: `Token ${this.apiKey}`,
        },
      }
    )

    if (response.statusCode === 404) {
      logger.warn(`Search ${caSearchId} not found`)
    } else if (response.statusCode === 204) {
      logger.info(`Search ${caSearchId} deleted.`)
    } else {
      throw new Error(
        `Failed to delete: status=${response.statusCode} body=${JSON.stringify(
          response
        )}`
      )
    }
  }

  async getSearchEntities(
    searchRef: string,
    params: {
      page?: number
    }
  ): Promise<ComplyAdvantageResponseSuccess<ComplyAdvantageEntity[]>> {
    const rawComplyAdvantageResponse = await apiFetch<
      ComplyAdvantageResponse<ComplyAdvantageEntity[]>
    >(
      `${COMPLY_ADVANTAGE_ROOT_URL}/searches/${searchRef}/entities/comply?page=${
        params.page ?? 1
      }`,
      {
        method: 'GET',
        headers: {
          Authorization: `Token ${this.apiKey}`,
        },
      }
    )

    return this.unwrapResult(rawComplyAdvantageResponse)
  }

  async patchMonitors(
    caSearchId: string,
    update: {
      enabled: boolean
      webhookUrl?: string
    }
  ) {
    const monitorResponse = await apiFetch<ComplyAdvantageResponse<unknown>>(
      `${COMPLY_ADVANTAGE_ROOT_URL}/searches/${caSearchId}/monitors`,
      {
        method: 'PATCH',
        body: JSON.stringify({
          is_monitored: update.enabled ?? false,
        }),
        headers: {
          Authorization: `Token ${this.apiKey}`,
        },
      }
    )

    this.unwrapResult(monitorResponse)
  }

  private unwrapResult<T>(
    rawResponse: ApiFetchResult<ComplyAdvantageResponse<T>>
  ): ComplyAdvantageResponseSuccess<T> {
    if (rawResponse.result?.status === 'failure') {
      throw new Error((rawResponse as any).message)
    }
    return rawResponse.result
  }
}
