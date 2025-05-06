import {
  SanctionsDataProviderName,
  SanctionsEntity,
  SanctionsSearchRequest,
  SanctionsSearchResponse,
  SourceDocument,
} from '@/@types/openapi-internal/all'

export type Action = 'add' | 'del' | 'chg'

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

export interface SanctionsSourceRepository {
  save(
    provider: SanctionsDataProviderName,
    entities: [Action, SourceDocument][],
    version: string
  ): Promise<void>
}

export interface SanctionsDataProvider {
  provider(): SanctionsDataProviderName
  search(
    request: SanctionsSearchRequest,
    isMigration?: boolean
  ): Promise<SanctionsProviderResponse>

  getSearch(providerSearchId: string): Promise<SanctionsProviderResponse>

  deleteSearch(providerSearchId: string): Promise<void>

  setMonitoring(providerSearchId: string, monitor: boolean): Promise<void>
}
