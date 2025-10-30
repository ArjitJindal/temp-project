import uniq from 'lodash/uniq'
import { Client } from '@opensearch-project/opensearch'
import { AnyBulkWriteOperation } from 'mongodb'
import {
  RELATIONSHIP_CODE_TO_NAME,
  LEVEL_TIER_MAP,
} from '../constants/dow-jones-constants'
import { normalizeSource } from '../utils'
import {
  Action,
  SanctionsRepository,
} from '@/services/sanctions/providers/types'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import { SanctionsEntity } from '@/@types/openapi-internal/SanctionsEntity'
import { SanctionsOccupation } from '@/@types/openapi-internal/SanctionsOccupation'
import { PepRank } from '@/@types/openapi-internal/PepRank'
import { SanctionsDataProviderName } from '@/@types/openapi-internal/SanctionsDataProviderName'
import { SanctionsAssociate } from '@/@types/openapi-internal/SanctionsAssociate'
import { hasFeature } from '@/core/utils/context'
import { bulkUpdate } from '@/utils/opensearch-utils'
import { generateHashFromString } from '@/utils/object'
import { GenericSanctionsSearchType } from '@/@types/openapi-internal/GenericSanctionsSearchType'
export class MongoSanctionsRepository implements SanctionsRepository {
  collectionName: string
  opensearchClient?: Client
  aliasName?: string
  constructor(
    collectionName: string,
    opensearchClient?: Client,
    aliasName?: string
  ) {
    this.collectionName = collectionName
    this.opensearchClient = opensearchClient
    this.aliasName = aliasName
  }
  async save(
    provider: SanctionsDataProviderName,
    entities: [Action, SanctionsEntity][],
    version: string
  ): Promise<void> {
    const client = await getMongoDbClient()
    const coll = client.db().collection(this.collectionName)

    const operations = entities.map(([action, entity]) => {
      switch (action) {
        case 'add':
          return {
            updateOne: {
              filter: {
                id: entity.id,
                provider,
                entityType: entity.entityType,
              },
              update: {
                $setOnInsert: {
                  createdAt: Date.now(),
                },
                $set: {
                  ...entity,
                  provider,
                  version,
                },
              },
              upsert: true,
            },
          }
        case 'chg':
          return {
            updateOne: {
              filter: {
                id: entity.id,
                provider,
                entityType: entity.entityType,
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
        case 'del':
          return {
            deleteOne: {
              filter: {
                id: entity.id,
                provider,
              },
            },
          }
        default:
          throw new Error(`Unsupported action: ${action}`)
      }
    })
    if (operations.length > 0) {
      if (this.opensearchClient) {
        await Promise.all([
          coll.bulkWrite(operations),
          bulkUpdate(
            provider,
            entities,
            version,
            this.aliasName ?? this.collectionName,
            this.opensearchClient
          ),
        ])
      } else {
        await coll.bulkWrite(operations)
      }
    }
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
    const coll = client.db().collection(this.collectionName)

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
        sanctionSearchTypes: GenericSanctionsSearchType[]
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
    const bulkWriteOperations = associations.flatMap(
      ([entityId, associateIds]) => {
        const operations: any[] = [
          {
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
          },
          {
            updateOne: {
              filter: {
                id: entityId,
                provider,
                version,
              },
              update: {
                $push: {
                  pepSources: {
                    category: 'PEP',
                    createdAt: Date.now(),
                    sourceName: normalizeSource(
                      LEVEL_TIER_MAP.PEP_BY_ASSOCIATIONS
                    ),
                    internalId: generateHashFromString(
                      normalizeSource(LEVEL_TIER_MAP.PEP_BY_ASSOCIATIONS)
                    ),
                  },
                  aggregatedSourceIds: `${generateHashFromString(
                    normalizeSource(LEVEL_TIER_MAP.PEP_BY_ASSOCIATIONS)
                  )}-PEP`,
                },
              },
            },
          },
        ]
        return operations
      }
    )
    if (bulkWriteOperations.length > 0) {
      if (hasFeature('OPEN_SEARCH') && this.opensearchClient) {
        const entities = associations.map(
          ([entityId, associateIds]) =>
            [
              'chg',
              {
                id: entityId,
                provider,
                associates: associateIds.map(({ id, association }) => ({
                  ...associateNameMap[id],
                  association: association
                    ? RELATIONSHIP_CODE_TO_NAME[association]
                    : undefined,
                })),
              },
            ] as [Action, Partial<SanctionsEntity>]
        )
        await Promise.all([
          coll.bulkWrite(bulkWriteOperations),
          bulkUpdate(
            provider,
            entities,
            version,
            this.aliasName ?? this.collectionName,
            this.opensearchClient
          ),
        ])
      } else {
        await coll.bulkWrite(bulkWriteOperations)
      }
    }
  }

  async saveSanctionsData(
    operations: AnyBulkWriteOperation<SanctionsEntity>[]
  ): Promise<void> {
    const client = await getMongoDbClient()
    const coll = client.db().collection<SanctionsEntity>(this.collectionName)
    await coll.bulkWrite(operations)
  }
}
