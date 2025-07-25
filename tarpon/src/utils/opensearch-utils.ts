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
import {
  Bulk_RequestBody,
  DeleteByQuery_RequestBody,
} from '@opensearch-project/opensearch/api'
import { v4 as uuidv4 } from 'uuid'
import { isEqual } from 'lodash'
import { defaultProvider } from '@aws-sdk/credential-provider-node'
import { SANCTIONS_SEARCH_INDEX_DEFINITION } from './opensearch-definitions'
import { SanctionsDataProviderName } from '@/@types/openapi-internal/SanctionsDataProviderName'
import { SanctionsEntity } from '@/@types/openapi-internal/SanctionsEntity'
import { Action } from '@/services/sanctions/providers/types'
import { logger } from '@/core/logger'
import { SanctionsDataProviders } from '@/services/sanctions/types'

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
    const response = await client.bulk(
      {
        body: operations,
      },
      {
        maxRetries: 3,
      }
    )
    if (response.body.errors) {
      const errors = response.body.items.filter(
        (item) =>
          Object.values(item)[0]?.status >= 400 && Object.values(item)[0]?.error
      )
      logger.info(
        `Error writing to opensearch handle retry: ${JSON.stringify(errors)}`
      )
      if (retry) {
        await bulkUpdate(provider, entities, version, indexName, client, false)
      }
    }
  } catch (e) {
    logger.error(`Error writing to opensearch: ${e}`)
  }
}

function getProviderNameFromIndexName(
  indexName: string
): SanctionsDataProviderName {
  if (indexName.includes(SanctionsDataProviders.ACURIS)) {
    return SanctionsDataProviders.ACURIS
  }
  if (indexName.includes(SanctionsDataProviders.OPEN_SANCTIONS)) {
    return SanctionsDataProviders.OPEN_SANCTIONS
  }
  if (indexName.startsWith('delta')) {
    return SanctionsDataProviders.ACURIS
  }
  return SanctionsDataProviders.DOW_JONES
}

export async function updateIndex(client: Client, indexName: string) {
  const aliasInfo = await client.indices.getAlias({ name: indexName })
  const currentIndexName = Object.keys(aliasInfo.body)[0]

  const newIndexName = indexName + '-' + uuidv4()
  await client.indices.create({
    index: newIndexName,
    body: SANCTIONS_SEARCH_INDEX_DEFINITION({
      aliasName: indexName,
      isDelta: indexName.includes('delta'),
      provider: getProviderNameFromIndexName(indexName),
    }),
  })

  try {
    const res = await client.reindex(
      {
        body: {
          source: {
            index: currentIndexName,
            size: 1000, // Add batch size to improve performance
          },
          dest: { index: newIndexName },
        },
        timeout: '60m', // Increased timeout
        wait_for_completion: true,
        refresh: false,
      },
      {
        requestTimeout: 3600000, // 60 minutes in milliseconds
        maxRetries: 0, // Allow retries
      }
    )
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

export async function createIndex(
  client: Client,
  indexName: string,
  aliasName?: string
) {
  const newIndexName = indexName + '-' + uuidv4()
  await client.indices.create({
    index: newIndexName,
    body: SANCTIONS_SEARCH_INDEX_DEFINITION({
      aliasName: aliasName ?? indexName,
      isDelta: indexName.includes('delta'),
      provider: getProviderNameFromIndexName(indexName),
    }),
  })

  await putAlias(client, newIndexName, aliasName ?? indexName)
}

export async function deleteIndex(client: Client, indexName: string) {
  await client.indices.delete({ index: indexName })
}

export async function putAlias(
  client: Client,
  indexName: string,
  aliasName: string
) {
  await client.indices.putAlias({
    index: indexName,
    name: aliasName,
  })
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
  const newDefinition = SANCTIONS_SEARCH_INDEX_DEFINITION({
    aliasName: indexName,
    isDelta: indexName.includes('delta'),
    provider: getProviderNameFromIndexName(indexName),
  })
  const newMapping = newDefinition.mappings
  const newSettings = newDefinition.settings

  return (
    !isEqual(currentMapping?.mappings, newMapping) ||
    !isEqual(currentSettings.settings?.index?.analysis, newSettings?.analysis)
  )
}

export async function checkIndexExists(client: Client, indexName: string) {
  const aliases = Object.values((await client.indices.getAlias()).body).flatMap(
    (index) => (index.aliases ? Object.keys(index.aliases) : [])
  )
  return Boolean(aliases.find((alias) => alias === indexName))
}

export async function createIndexIfNotExists(
  client: Client,
  indexName: string
) {
  if (!(await checkIndexExists(client, indexName))) {
    await createIndex(client, indexName)
  }
}

export async function deleteDocumentsByQuery(
  client: Client | undefined,
  indexName: string,
  body: DeleteByQuery_RequestBody
) {
  if (!client || !(await checkIndexExists(client, indexName))) {
    return
  }
  await client.deleteByQuery({
    index: indexName,
    body: body,
    conflicts: 'proceed',
    wait_for_completion: true,
  })
}

//Use this function to create index with the latest definition when loading data from a provider
export async function syncOpensearchIndex(
  client: Client | undefined,
  indexName: string
) {
  if (!client) {
    return
  }
  logger.info(`Syncing index ${indexName}`)
  await createIndexIfNotExists(client, indexName)
  const hasChanged = await hasIndexChanged(client, indexName)
  if (hasChanged) {
    const aliasName = uuidv4()
    await createIndex(client, indexName, aliasName)
    return aliasName
  }
}

export async function getIndexWithAliasName(client: Client, aliasName: string) {
  const aliasInfo = await client.indices.getAlias({ name: aliasName })
  const currentIndexName = Object.keys(aliasInfo.body)[0]
  return currentIndexName
}

export async function deleteIndexAfterDataLoad(
  client: Client,
  indexName: string,
  aliasName: string
) {
  logger.info(`Deleting index ${indexName} after data load`)

  const indexToDelete = await getIndexWithAliasName(client, indexName)
  const indexToKeep = await getIndexWithAliasName(client, aliasName)
  if (indexToDelete !== indexToKeep) {
    if (!indexToDelete) {
      await putAlias(client, indexToKeep, indexName)
      return
    }
    const indexAliasToDelete = uuidv4()
    await putAlias(client, indexToDelete, indexAliasToDelete)
    await putAlias(client, indexToKeep, indexName)
    await client.indices.deleteAlias({
      index: indexToKeep,
      name: aliasName,
    })
    await deleteIndex(client, indexToDelete)
  }
}

export async function keepAlive(client: Client) {
  try {
    await client.ping(undefined, {
      maxRetries: 3,
      requestTimeout: 5000,
    })

    await client.search(
      {
        index: '_all',
        body: {
          query: { match_all: {} },
          size: 0,
        },
      },
      {
        requestTimeout: 5000,
        maxRetries: 1,
      }
    )

    logger.debug('OpenSearch keep-alive successful')
  } catch (error) {
    logger.warn('OpenSearch keep-alive failed:', error)
  }
}

export function isOpensearchAvailableInRegion() {
  const [stage, region] = stageAndRegion()
  const config = getTarponConfig(stage, region)
  return config.opensearch.availability && config.opensearch.deploy
}
