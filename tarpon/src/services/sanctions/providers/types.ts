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
    action: Action,
    provider: SanctionsDataProviderName,
    entity: Entity
  ): Promise<void>
}

export interface SanctionsDataFetcher {
  provider(): SanctionsDataProviderName

  fullLoad(repo: SanctionsRepository): Promise<void>

  delta(repo: SanctionsRepository, from: Date): Promise<void>
}
