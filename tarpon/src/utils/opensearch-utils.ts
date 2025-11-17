import https from 'https'
import { getTarponConfig } from '@flagright/lib/constants/config'
import { stageAndRegion } from '@flagright/lib/utils'
import { Client } from '@opensearch-project/opensearch'
import { AwsSigv4Signer } from '@opensearch-project/opensearch/aws'
import {
  Bulk_RequestBody,
  DeleteByQuery_RequestBody,
  Indices_Create_RequestBody,
} from '@opensearch-project/opensearch/api'
import { v4 as uuidv4 } from 'uuid'
import chunk from 'lodash/chunk'
import isEqual from 'lodash/isEqual'
import { defaultProvider } from '@aws-sdk/credential-provider-node'
import { backOff } from 'exponential-backoff'
import {
  OpenSearchClient,
  DescribeDomainsCommand,
} from '@aws-sdk/client-opensearch'
import { SANCTIONS_SEARCH_INDEX_DEFINITION } from './opensearch-definitions'
import { getSecret } from './secrets-manager'
import { envIs } from './env'
import { SanctionsDataProviderName } from '@/@types/openapi-internal/SanctionsDataProviderName'
import { SanctionsEntity } from '@/@types/openapi-internal/SanctionsEntity'
import { Action } from '@/services/sanctions/providers/types'
import { logger } from '@/core/logger'
import { SanctionsDataProviders } from '@/services/sanctions/types'
import { UserSearchEntity } from '@/@types/openapi-internal/UserSearchEntity'

export async function getDomainEndpoint(
  stage: string,
  region: string,
  awsRegion: string
): Promise<string> {
  const secretName = `opensearch-${stage}-${region}-endpoint`

  try {
    const secret = await getSecret<{ endpoint: string }>(secretName)
    if (secret?.endpoint) {
      return secret.endpoint
    }
    logger.info(
      `No endpoint found in Secrets Manager, falling back to API discovery`
    )
  } catch (error) {
    logger.warn(
      `Could not fetch OpenSearch endpoint from Secrets Manager (${secretName}), falling back to API discovery`
    )
  }
  const domains = [`${stage}-${region}-opensearch`]
  const client = new OpenSearchClient({
    region: awsRegion,
    maxAttempts: 3,
  })

  const response = await client.send(
    new DescribeDomainsCommand({ DomainNames: domains })
  )

  const domainStatus = response.DomainStatusList?.[0]
  if (envIs('sandbox') || envIs('prod')) {
    if (!domainStatus?.Endpoints?.vpc) {
      throw new Error(`Endpoint not found for domain "${domains[0]}"`)
    }
    return `https://${domainStatus?.Endpoints?.vpc}`
  } else {
    if (!domainStatus?.Endpoint) {
      throw new Error(`Endpoint not found for domain "${domains[0]}"`)
    }
    return `https://${domainStatus.Endpoint}`
  }
}

export async function getOpensearchClient(): Promise<Client> {
  const [stage, region] = stageAndRegion()
  const config = getTarponConfig(stage, region)

  if (config.stage === 'local') {
    return getLocalClient()
  }

  const domainEndpoint = await getDomainEndpoint(
    stage,
    config.region as string,
    config.env.region as string
  )

  const client = new Client({
    node: domainEndpoint,
    ...AwsSigv4Signer({
      region: config.env.region as string,
      service: 'es',
      getCredentials: defaultProvider(),
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

export async function opensearchUpdateOne(
  entity: Partial<UserSearchEntity>,
  indexName: string,
  client: Client
) {
  if (!(await checkIndexExists(client, indexName))) {
    return
  }
  await client.index({
    index: indexName,
    id: entity.id,
    body: entity,
  })
}

export async function bulkUpdateUserSearch(
  data: UserSearchEntity[],
  indexName: string,
  client: Client
) {
  for (const entities of chunk(data, 100)) {
    const operations: Bulk_RequestBody = entities.map((entity) => {
      return [
        { update: { _index: indexName, _id: entity.id } },
        { doc: entity, doc_as_upsert: true },
      ]
    })
    await client.bulk({
      body: operations,
    })
  }
}
export async function bulkUpdate(
  provider: SanctionsDataProviderName,
  data: [Action, Partial<SanctionsEntity>][],
  version: string,
  indexName: string,
  client: Client
) {
  for (const entities of chunk(data, 100)) {
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
      await backOff(
        async () => {
          const response = await client.bulk({
            body: operations,
          })
          if (response.body.errors) {
            throw new Error('Error writing to opensearch, retrying...')
          }
        },
        {
          numOfAttempts: 5,
          timeMultiple: 2,
          maxDelay: 10000,
          jitter: 'none',
          startingDelay: 1000,
        }
      )
    } catch (e) {
      logger.info(`Error writing to opensearch: ${e}`)
    }
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
  aliasName?: string,
  indexDefinition?: Indices_Create_RequestBody
) {
  logger.info(`Creating index ${indexName}`)
  const newIndexName = indexName + '-' + uuidv4()
  await client.indices.create({
    index: newIndexName,
    body:
      indexDefinition ??
      SANCTIONS_SEARCH_INDEX_DEFINITION({
        aliasName: aliasName ?? indexName,
        isDelta: indexName.includes('delta'),
        provider: getProviderNameFromIndexName(indexName),
      }),
  })
  logger.info(`Created index ${indexName}`)
  await putAlias(client, newIndexName, aliasName ?? indexName)
  logger.info(`Put alias ${aliasName ?? indexName} to index ${indexName}`)
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

export async function deleteByQuery(
  client: Client,
  indexName: string,
  query: DeleteByQuery_RequestBody
) {
  await client.deleteByQuery({
    index: indexName,
    body: query,
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
  indexName: string,
  indexDefinition?: Indices_Create_RequestBody
) {
  if (!(await checkIndexExists(client, indexName))) {
    logger.info(`Creating index ${indexName}`)
    await createIndex(client, indexName, undefined, indexDefinition)
    return
  }
  logger.info(`Index ${indexName} already exists`)
}

async function deleteDocumentsByVersionInternal(
  client: Client,
  index: string,
  versionValue: string
) {
  let searchAfter: string | undefined = undefined
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const response = await client.search({
      index,
      _source: false,
      size: 1000,
      body: {
        query: {
          bool: {
            must_not: { term: { version: versionValue } },
          },
        },
        sort: ['_id'],
        ...(searchAfter ? { search_after: [searchAfter] } : {}),
      },
    })
    const matchingIds: string[] = response.body.hits.hits.map((doc) => doc._id)
    if (matchingIds.length === 0) {
      return
    }
    await client.bulk({
      body: matchingIds.map((id) => ({ delete: { _index: index, _id: id } })),
    })
    searchAfter = matchingIds[matchingIds.length - 1]
  }
}

export async function deleteDocumentsByVersion(
  client: Client | undefined,
  aliasName: string,
  version: string
) {
  if (!client || !(await checkIndexExists(client, aliasName))) {
    logger.info(
      `No client found for index ${aliasName} or index does not exist`
    )
    return
  }

  const indexName = await getIndexWithAliasName(client, aliasName)
  if (!indexName) {
    logger.info(`Index ${aliasName} does not exist`)
    return
  }
  logger.info(
    `Deleting documents by version ${version} for index ${indexName} for alias ${aliasName}`
  )
  await deleteDocumentsByVersionInternal(client, indexName, version)
  logger.info(`Deleted documents by version ${version}`)
}

//Use this function to create index with the latest definition when loading data from a provider
export async function syncOpensearchIndex(
  client: Client | undefined,
  indexName: string
) {
  if (!client) {
    logger.info(`No client found for index ${indexName}`)
    return
  }
  logger.info(`Syncing index ${indexName}`)
  await createIndexIfNotExists(client, indexName)
  const hasChanged = await hasIndexChanged(client, indexName)
  logger.info(`Index ${indexName} has changed: ${hasChanged}`)
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
  return config.opensearch.deploy
}

export async function getSharedOpensearchClient(): Promise<Client> {
  const [stage, region] = stageAndRegion()
  const config = getTarponConfig(stage, region)

  if (config.stage === 'local') {
    return getLocalClient()
  }

  logger.info(
    'Creating shared OpenSearch client with optimized connection pooling'
  )

  const domainEndpoint = await getDomainEndpoint(
    stage,
    config.region as string,
    config.env.region as string
  )

  const client = new Client({
    node: domainEndpoint,
    ...AwsSigv4Signer({
      region: config.env.region as string,
      service: 'es',
      getCredentials: defaultProvider(),
    }),

    agent: () => {
      return new https.Agent({
        keepAlive: true,
        keepAliveMsecs: 30000,
        maxSockets: 150,
        maxFreeSockets: 30,
        timeout: 30000,
        scheduling: 'fifo',
      })
    },

    pingTimeout: 3000,
    requestTimeout: 30000,
    maxRetries: 3,
    sniffOnStart: false,
    sniffInterval: false,
    sniffOnConnectionFault: false,

    compression: 'gzip',
  })
  return client
}
