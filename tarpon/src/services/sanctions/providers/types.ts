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

export type SanctionsDataProviderName = 'dowjones'

export type Action = 'add' | 'remove' | 'change'

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
