import { Indices_Create_RequestBody } from '@opensearch-project/opensearch/api'
import { SanctionsDataProviderName } from '@/@types/openapi-internal/SanctionsDataProviderName'
import { SanctionsDataProviders } from '@/services/sanctions/types'

type SanctionsSearchIndexDefinitionProps = {
  aliasName: string
  isDelta?: boolean
  provider: SanctionsDataProviderName
  aggregatedIndex?: boolean
}

export const SANCTIONS_SEARCH_INDEX_DEFINITION = (
  props: SanctionsSearchIndexDefinitionProps
): Indices_Create_RequestBody => {
  const {
    aliasName,
    isDelta = false,
    provider,
    aggregatedIndex = false,
  } = props
  const isDowJones = provider === SanctionsDataProviders.DOW_JONES
  return {
    settings: {
      analysis: {
        filter: {
          remove_the: {
            type: 'stop',
            stopwords: ['the'],
          },
        },
        analyzer: {
          name_analyzer: {
            type: 'custom',
            tokenizer: 'standard',
            filter: [],
          },
          name_analyzer_with_stopword_removal: {
            type: 'custom',
            tokenizer: 'standard',
            filter: ['remove_the'],
          },
        },
      },
      index: {
        number_of_shards: 1,
        number_of_replicas: 1,
      },
    },
    mappings: {
      dynamic: 'false',
      properties: {
        id: { type: 'keyword' },
        normalizedAka: {
          type: 'text',
          analyzer: 'name_analyzer_with_stopword_removal',
          fields: {
            fuzzy_with_stopwords_removal: {
              type: 'text',
              analyzer: 'name_analyzer_with_stopword_removal',
            },
            fuzzy: {
              type: 'text',
              analyzer: 'name_analyzer',
            },
            exact: { type: 'keyword' },
          },
        },
        nationality: { type: 'keyword' },
        yearOfBirth: { type: 'keyword' },
        gender: { type: 'keyword' },
        associates: {
          type: 'nested',
          properties: {
            ranks: {
              type: 'keyword',
            },
            sanctionsSearchTypes: {
              type: 'keyword',
            },
          },
        },
        aggregatedSourceIds: {
          type: 'keyword',
        },
        ...(!aggregatedIndex
          ? {
              sanctionSearchTypes: {
                type: 'keyword',
              },
            }
          : {}),
        ...(isDelta || isDowJones
          ? {
              provider: {
                type: 'keyword',
              },
            }
          : {}),
        ...(aggregatedIndex || isDelta || isDowJones
          ? {
              entityType: { type: 'keyword' },
            }
          : {}),
        ...(isDowJones
          ? {
              documents: {
                type: 'nested',
                properties: {
                  formattedId: { type: 'keyword' },
                  id: { type: 'keyword' },
                },
              },
              occupations: {
                type: 'nested',
                properties: {
                  rank: { type: 'keyword' },
                },
              },
            }
          : {}),
        version: { type: 'keyword' },
      },
    },
    aliases: {
      [aliasName]: {},
    },
  }
}

export const USER_SEARCH_INDEX_DEFINITION = (
  aliasName: string
): Indices_Create_RequestBody => {
  return {
    settings: {
      analysis: {
        analyzer: {
          name_analyzer: {
            type: 'custom',
            tokenizer: 'standard',
            filter: [],
          },
        },
      },
      index: {
        number_of_shards: 1,
        number_of_replicas: 1,
      },
    },
    mappings: {
      dynamic: 'false',
      properties: {
        id: { type: 'keyword' },
        userName: {
          type: 'text',
          fields: {
            fuzzy: {
              type: 'text',
              analyzer: 'name_analyzer',
            },
            exact: { type: 'keyword' },
          },
        },
        legalEntityName: {
          type: 'text',
          fields: {
            fuzzy: {
              type: 'text',
              analyzer: 'name_analyzer',
            },
            exact: { type: 'keyword' },
          },
        },
        shareHoldersNames: {
          type: 'text',
          fields: {
            fuzzy: {
              type: 'text',
              analyzer: 'name_analyzer',
            },
            exact: { type: 'keyword' },
          },
        },
        directorsNames: {
          type: 'text',
          fields: {
            fuzzy: {
              type: 'text',
              analyzer: 'name_analyzer',
            },
            exact: { type: 'keyword' },
          },
        },
      },
    },
    aliases: {
      [aliasName]: {},
    },
  }
}
