import {
  OpenSearchServerlessClient,
  ListCollectionsCommand,
  ListCollectionsCommandOutput,
} from '@aws-sdk/client-opensearchserverless'
import { Config } from '@flagright/lib/config/config'
import { getTarponConfig } from '@flagright/lib/constants/config'
import { stageAndRegion } from '@flagright/lib/utils'
import { Client } from '@opensearch-project/opensearch'
import { AwsSigv4Signer } from '@opensearch-project/opensearch/aws'
import { Bulk_RequestBody } from '@opensearch-project/opensearch/api'
import { v4 as uuidv4 } from 'uuid'
import { isEqual } from 'lodash'
import { defaultProvider } from '@aws-sdk/credential-provider-node'
import { SANCTIONS_SEARCH_INDEX_DEFINITION } from './opensearch-definitions'
import { envIsNot } from './env'
import { SanctionsDataProviderName } from '@/@types/openapi-internal/SanctionsDataProviderName'
import { SanctionsEntity } from '@/@types/openapi-internal/SanctionsEntity'
import { Action } from '@/services/sanctions/providers/types'
import { hasFeature } from '@/core/utils/context'
import { logger } from '@/core/logger'

export async function getCollectionEndpoint(config: Config): Promise<string> {
  const collectionName = `${config.stage}-${config.region ?? ''}-opensearch`
  const client = new OpenSearchServerlessClient({ region: config.env.region })
  const command = new ListCollectionsCommand({
    collectionFilters: { name: collectionName },
  })
  const response: ListCollectionsCommandOutput = await client.send(command)
  if (response.collectionSummaries && response.collectionSummaries.length > 0) {
    const collectionId = response.collectionSummaries[0].id
    if (collectionId) {
      return `https://${collectionId}.${config.env.region}.aoss.amazonaws.com`
    }
    throw new Error('Collection ID not found')
  }
  throw new Error('Collection not found')
}

export async function getOpensearchClient(): Promise<Client> {
  const [stage, region] = stageAndRegion()
  const config = getTarponConfig(stage, region)
  if (config.stage === 'local') {
    return getLocalClient()
  }
  const collectionEndpoint = await getCollectionEndpoint(config)
  if (!collectionEndpoint || !config.env.region) {
    throw new Error('Collection endpoint not found')
  }
  const client = new Client({
    node: collectionEndpoint,
    ...AwsSigv4Signer({
      region: config.env.region,
      getCredentials: defaultProvider(),
      service: 'aoss',
    }),
  })
  return client
}

function getLocalClient(): Client {
  const host = 'localhost'
  const protocol = 'http'
  const port = 9200

  const client = new Client({
    node: protocol + '://' + host + ':' + port,
  })

  return client
}

export async function bulkUpdate(
  provider: SanctionsDataProviderName,
  entities: [Action, Partial<SanctionsEntity>][],
  version: string,
  indexName: string,
  client: Client,
  retry: boolean = true
) {
  const operations: Bulk_RequestBody = entities.flatMap(
    ([action, entity]): Bulk_RequestBody => {
      const e = {
        ...entity,
        provider,
        version,
      }
      switch (action) {
        case 'add':
          return [
            { update: { _index: indexName, _id: entity.id } },
            { doc: e, doc_as_upsert: true },
          ]
        case 'chg':
          return [
            { update: { _index: indexName, _id: entity.id } },
            { doc: e, doc_as_upsert: true },
          ]
        case 'del':
          return [{ delete: { _index: indexName, _id: entity.id } }]
      }
    }
  )
  try {
    const response = await client.bulk({
      body: operations,
    })
    if (response.body.errors) {
      const errors = response.body.items.filter(
        (item) => item[1].status >= 400 && item[1].error
      )
      logger.error(`Error writing to opensearch: ${JSON.stringify(errors)}`)
      if (retry) {
        await bulkUpdate(provider, entities, version, indexName, client, false)
      }
    }
  } catch (e) {
    logger.error(`Error writing to opensearch: ${JSON.stringify(e)}`)
  }
}

export async function updateIndex(client: Client, indexName: string) {
  const aliasInfo = await client.indices.getAlias({ name: indexName })
  const currentIndexName = Object.keys(aliasInfo.body)[0]

  const newIndexName = indexName + '-' + uuidv4()
  await client.indices.create({
    index: newIndexName,
    body: SANCTIONS_SEARCH_INDEX_DEFINITION(indexName),
  })

  try {
    const res = await client.reindex({
      body: {
        source: { index: currentIndexName },
        dest: { index: newIndexName },
      },
    })
    if ('failures' in res.body && res.body.failures.length > 0) {
      await client.indices.delete({ index: newIndexName })
      throw new Error(
        `Error reindexing opensearch: ${JSON.stringify(res.body.failures)}`
      )
    } else {
      await client.indices.putAlias({
        index: newIndexName,
        name: indexName,
      })
      await client.indices.delete({ index: currentIndexName })
    }
  } catch (e) {
    throw new Error(`Error reindexing opensearch: ${JSON.stringify(e)}`)
  }
}

export async function createIndex(client: Client, indexName: string) {
  const newIndexName = indexName + '-' + uuidv4()
  await client.indices.create({
    index: newIndexName,
    body: SANCTIONS_SEARCH_INDEX_DEFINITION(indexName),
  })

  await client.indices.putAlias({
    index: newIndexName,
    name: indexName,
  })
}

export async function deleteIndex(client: Client, indexName: string) {
  await client.indices.delete({ index: indexName })
}

export async function getIndexMapping(client: Client, indexName: string) {
  const mapping = await client.indices.getMapping({ index: indexName })
  return Object.values(mapping.body)?.[0]
}

export async function getIndexSettings(client: Client, indexName: string) {
  const settings = await client.indices.getSettings({ index: indexName })
  return Object.values(settings.body)?.[0]
}

export async function hasIndexChanged(client: Client, indexName: string) {
  const currentMapping = await getIndexMapping(client, indexName)
  const currentSettings = await getIndexSettings(client, indexName)
  const newMapping = SANCTIONS_SEARCH_INDEX_DEFINITION(indexName).mappings
  const newSettings = SANCTIONS_SEARCH_INDEX_DEFINITION(indexName).settings
  return (
    !isEqual(currentMapping, newMapping) ||
    !isEqual(currentSettings, newSettings)
  )
}

export async function syncOpensearchIndexes() {
  if (hasFeature('OPEN_SEARCH') && envIsNot('prod')) {
    const client = await getOpensearchClient()
    const aliases = Object.values(
      (await client.indices.getAlias()).body
    ).flatMap((index) => (index.aliases ? Object.keys(index.aliases) : []))
    const targetIndexes = aliases?.filter((index: string) =>
      index.includes('sanctions')
    )
    for (const index of targetIndexes) {
      const hasChanged = await hasIndexChanged(client, index)
      if (hasChanged) {
        await updateIndex(client, index)
      }
    }
  }
}

export async function createIndexIfNotExists(
  client: Client,
  indexName: string
) {
  const aliases = Object.values((await client.indices.getAlias()).body).flatMap(
    (index) => (index.aliases ? Object.keys(index.aliases) : [])
  )
  if (!aliases.find((alias) => alias === indexName)) {
    await createIndex(client, indexName)
  }
}
