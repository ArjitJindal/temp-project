import {
  SanctionsSearchResponse,
  SanctionsSearchType,
} from '@/@types/openapi-internal/all'

export interface Entity {
  id: string
  name: Name
  entityType: string
  aka: Name[]
}

interface Name {
  firstName: string
  surname: string
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

export interface SanctionsDataFetcher {
  provider(): SanctionsDataProviderName

  fullLoad(repo: SanctionsRepository, version: string): Promise<void>

  delta(repo: SanctionsRepository, version: string, from: Date): Promise<void>
}

export type SanctionsProviderSearchRequest = {
  types: SanctionsSearchType[]
  searchTerm: string
  fuzziness?: number
  countryCodes?: Array<string>
  yearOfBirth?: number
}

export interface SanctionsDataProvider {
  name(): SanctionsDataProviderName
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
