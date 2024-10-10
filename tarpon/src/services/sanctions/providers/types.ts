import {
  SanctionsEntity,
  SanctionsSearchRequest,
  SanctionsSearchResponse,
} from '@/@types/openapi-internal/all'

export type SanctionsDataProviderName = 'dowjones' | 'comply-advantage'

export type Action = 'add' | 'remove' | 'change'

export type SanctionsProviderResponse = Omit<
  SanctionsSearchResponse,
  'searchId'
>

export interface SanctionsRepository {
  save(
    provider: SanctionsDataProviderName,
    entities: [Action, SanctionsEntity][],
    version: string
  ): Promise<void>

  saveAssociations(
    provider: SanctionsDataProviderName,
    associations: [string, { id: string; association: string }[]][],
    version: string
  ): Promise<void>
}

export interface SanctionsDataProvider {
  provider(): SanctionsDataProviderName
  search(request: SanctionsSearchRequest): Promise<SanctionsProviderResponse>

  getSearch(providerSearchId: string): Promise<SanctionsProviderResponse>

  deleteSearch(providerSearchId: string): Promise<void>

  setMonitoring(providerSearchId: string, monitor: boolean): Promise<void>
}
