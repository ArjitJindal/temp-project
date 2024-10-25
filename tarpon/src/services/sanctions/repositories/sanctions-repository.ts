import { uniq } from 'lodash'
import { RELATIONSHIP_CODE_TO_NAME } from '../providers/dow-jones-provider'
import {
  Action,
  SanctionsRepository,
} from '@/services/sanctions/providers/types'
import { SanctionsEntity } from '@/@types/openapi-internal/SanctionsEntity'
import { PepRank } from '@/@types/openapi-internal/PepRank'
import { SanctionsDataProviderName } from '@/@types/openapi-internal/SanctionsDataProviderName'
import { SanctionsAssociate } from '@/@types/openapi-internal/SanctionsAssociate'
import {
  bulkInsertToClickhouse,
  executeClickhouseQuery,
} from '@/utils/clickhouse/utils'

export class ClickhouseSanctionsRepository implements SanctionsRepository {
  async save(
    provider: SanctionsDataProviderName,
    entities: [Action, SanctionsEntity][],
    version: string
  ): Promise<void> {
    const objects = entities
      .map(([action, entity]) => {
        const entityToInsert = { version, provider, ...entity }
        switch (action) {
          case 'add':
          case 'change':
            return entityToInsert
          case 'remove':
            // TODO ask Aman how to do this, not a blocker
            return
          default:
            throw new Error(`Unsupported action: ${action}`)
        }
      })
      .filter((obj): obj is any => Boolean(obj))
    return await bulkInsertToClickhouse('sanctions_data', objects, 'flagright')
  }

  async saveAssociations(
    provider: SanctionsDataProviderName,
    associations: [
      string,
      {
        id: string
        association: string
      }[]
    ][],
    version: string
  ) {
    if (associations.length === 0) {
      return
    }

    const associationIds = associations.flatMap(([_, associationIds]) =>
      associationIds.map((a) => a.id)
    )

    const entityIds = associations.map(([id]) => id)

    const rowIds = uniq(associationIds.concat(...entityIds))

    const selectQuery = `SELECT data
                         FROM sanctions_data
                         WHERE id IN (${rowIds
                           .map((id) => `'${id}'`)
                           .join(', ')})
                         AND provider = '${provider}' AND version = '${version}'`

    const results = await executeClickhouseQuery<{
      data: string
    }>('flagright', selectQuery, {})
    const allEntities = results.map(
      (r) => JSON.parse(r.data) as SanctionsEntity
    )
    const entityMap = allEntities.reduce<{ [id: string]: SanctionsEntity }>(
      (acc, entity) => {
        acc[entity.id] = entity
        return acc
      },
      {}
    )

    const associates = associationIds.map((id) => entityMap[id])

    const associateNameMap = associates.filter(Boolean).reduce<{
      [key: string]: SanctionsAssociate
    }>((acc, { id, name, occupations, sanctionSearchTypes }) => {
      acc[id] = {
        name,
        ranks: occupations
          ?.map((occupation) => occupation.rank)
          .filter((rank): rank is PepRank => rank != null),
        sanctionsSearchTypes: sanctionSearchTypes ?? [],
      }
      return acc
    }, {})

    const objects = associations.map(([entityId, associateIds]) => {
      const associates = associateIds
        .filter(Boolean)
        .map(({ id, association }) => ({
          ...associateNameMap[id],
          association: association
            ? RELATIONSHIP_CODE_TO_NAME[association]
            : undefined,
        }))
      const entity = entityMap[entityId]
      return {
        ...entity,
        associates,
      }
    })
    await bulkInsertToClickhouse('sanctions_data', objects, 'flagright')
  }
}
