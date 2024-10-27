import { uniq } from 'lodash'
import { RELATIONSHIP_CODE_TO_NAME } from '../providers/dow-jones-provider'
import {
  Action,
  SanctionsRepository,
} from '@/services/sanctions/providers/types'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import { SANCTIONS_COLLECTION } from '@/utils/mongodb-definitions'
import { SanctionsEntity } from '@/@types/openapi-internal/SanctionsEntity'
import { SanctionsSearchType } from '@/@types/openapi-internal/SanctionsSearchType'
import { SanctionsOccupation } from '@/@types/openapi-internal/SanctionsOccupation'
import { PepRank } from '@/@types/openapi-internal/PepRank'
import { SanctionsDataProviderName } from '@/@types/openapi-internal/SanctionsDataProviderName'
import { SanctionsAssociate } from '@/@types/openapi-internal/SanctionsAssociate'

export class MongoSanctionsRepository implements SanctionsRepository {
  async save(
    provider: SanctionsDataProviderName,
    entities: [Action, SanctionsEntity][],
    version: string
  ): Promise<void> {
    const client = await getMongoDbClient()
    const coll = client.db().collection(SANCTIONS_COLLECTION)

    const operations = entities.map(([action, entity]) => {
      switch (action) {
        case 'add':
          return {
            updateOne: {
              filter: { id: entity.id, version, provider },
              update: {
                $setOnInsert: {
                  ...entity,
                  provider,
                  version,
                  createdAt: Date.now(),
                },
              },
              upsert: true,
            },
          }
        case 'change':
          return {
            updateOne: {
              filter: {
                id: entity.id,
                provider,
                version,
                deletedAt: { $exists: false },
              },
              update: {
                $set: {
                  ...entity,
                  version,
                  updatedAt: Date.now(),
                },
              },
            },
          }
        case 'remove':
          return {
            updateOne: {
              filter: {
                id: entity.id,
                provider,
                version,
                deletedAt: { $exists: false },
              },
              update: {
                $set: {
                  ...entity,
                  version,
                  deletedAt: Date.now(),
                },
              },
            },
          }
        default:
          throw new Error(`Unsupported action: ${action}`)
      }
    })

    await coll.bulkWrite(operations)
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
    const client = await getMongoDbClient()
    const coll = client.db().collection(SANCTIONS_COLLECTION)

    const assocationIds = uniq(
      associations.flatMap(([_, associationIds]) =>
        associationIds.map((a) => a.id)
      )
    )
    const associates = await coll
      .aggregate<{
        id: string
        name: string
        occupations: SanctionsOccupation[]
        sanctionSearchTypes: SanctionsSearchType[]
      }>([
        { $match: { id: { $in: assocationIds }, provider, version } },
        {
          $project: {
            id: 1,
            name: 1,
            provider: 1,
            version: 1,
            occupations: 1,
            sanctionSearchTypes: 1,
          },
        },
      ])
      .toArray()

    const associateNameMap = associates.reduce<{
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

    await coll.bulkWrite(
      associations.map(([entityId, associateIds]) => {
        return {
          updateOne: {
            filter: {
              id: entityId,
              provider,
              version,
            },
            update: {
              $set: {
                associates: associateIds.map(({ id, association }) => ({
                  ...associateNameMap[id],
                  association: association
                    ? RELATIONSHIP_CODE_TO_NAME[association]
                    : undefined,
                })),
              },
            },
          },
        }
      })
    )
  }
}
