import { Indices_Create_RequestBody } from '@opensearch-project/opensearch/api'

export const SANCTIONS_SEARCH_INDEX_DEFINITION = (
  aliasName: string
): Indices_Create_RequestBody => {
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
          name_analyzer_with_stopwords: {
            type: 'custom',
            tokenizer: 'standard',
            filter: ['remove_the'],
          },
        },
      },
      index: {
        number_of_shards: 3,
        number_of_replicas: 1,
      },
    },
    mappings: {
      dynamic: 'false',
      properties: {
        id: { type: 'keyword' },
        normalizedAka: {
          type: 'text',
          analyzer: 'name_analyzer_with_stopwords',
          fields: {
            fuzzy_with_stopwords: {
              type: 'text',
              analyzer: 'name_analyzer_with_stopwords',
              search_analyzer: 'name_analyzer_with_stopwords',
            },
            fuzzy: {
              type: 'text',
              analyzer: 'name_analyzer',
              search_analyzer: 'name_analyzer',
            },
            exact: { type: 'keyword' },
          },
        },
        entityType: { type: 'keyword' },
        nationality: { type: 'keyword' },
        yearOfBirth: { type: 'keyword' },
        isActivePep: { type: 'boolean' },
        sanctionSearchTypes: { type: 'keyword' },
        countries: { type: 'keyword' },
        gender: { type: 'keyword' },
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
        provider: {
          type: 'keyword',
        },
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
        isActiveSanctioned: { type: 'boolean' },
      },
    },
    aliases: {
      [aliasName]: {},
    },
  }
}
