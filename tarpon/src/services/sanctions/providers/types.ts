import {
  SanctionsSearchResponse,
  SanctionsSearchType,
} from '@/@types/openapi-internal/all'

export interface Entity {
  id: string
  name: string
  entityType: string
  aka: string[]
  // TODO convert to ISO country codes
  countryOfResidence: string
  yearOfBirth: string
  function: string
  issuingAuthority: string
  originalCountryText: string
  originalPlaceOfBirthText: string
  otherInformation: string
  placeOfBirth: string
  reason: string
  registrationNumber: string
  relatedURL: string
}

export type SanctionsDataProviderName = 'dowjones' | 'comply-advantage'

export type Action = 'add' | 'remove' | 'change'

export type SanctionsProviderResponse = Omit<
  SanctionsSearchResponse,
  'searchId'
>

export interface SanctionsRepository {
  save(
    provider: SanctionsDataProviderName,
    entities: [Action, Entity][],
    version: string
  ): Promise<void>
}

export type SanctionsProviderSearchRequest = {
  types: SanctionsSearchType[]
  searchTerm: string
  fuzziness?: number
  countryCodes?: Array<string>
  yearOfBirth?: number
}

export interface SanctionsDataProvider {
  provider(): SanctionsDataProviderName
  search(
    request: SanctionsProviderSearchRequest
  ): Promise<SanctionsProviderResponse>

  getSearch(
    providerSearchId: string | number
  ): Promise<SanctionsProviderResponse>

  deleteSearch(providerSearchId: string | number): Promise<void>

  setMonitoring(
    providerSearchId: string | number,
    monitor: boolean
  ): Promise<void>
}
