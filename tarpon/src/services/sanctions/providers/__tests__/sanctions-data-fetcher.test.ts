import { MongoClient, Collection } from 'mongodb'
import { SanctionsDataFetcher } from '../sanctions-data-fetcher'
import {
  SanctionsProviderResponse,
  SanctionsRepository,
} from '@/services/sanctions/providers/types'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import { SANCTIONS_PROVIDER_SEARCHES_COLLECTION } from '@/utils/mongodb-definitions'
import { ClickhouseSanctionsRepository } from '@/services/sanctions/repositories/sanctions-repository'
import {
  createTenantDatabase,
  getClickhouseClient,
} from '@/utils/clickhouse/utils'
import { withFeatureHook } from '@/test-utils/feature-test-utils'
import { withContext } from '@/core/utils/context'
import { SanctionsEntity } from '@/@types/openapi-internal/SanctionsEntity'
import { SanctionsSearchRequest } from '@/@types/openapi-internal/SanctionsSearchRequest'

withFeatureHook(['CLICKHOUSE_ENABLED'])

// Extend the SanctionsDataFetcher for testing purposes
class TestSanctionsDataFetcher extends SanctionsDataFetcher {
  constructor() {
    super('dowjones')
  }
  // Implement abstract methods as no-op for this test
  async fullLoad() {}
  async delta() {}
}

describe('SanctionsDataFetcher Integration Tests', () => {
  let client: MongoClient
  let searchCollection: Collection<SanctionsProviderResponse>
  let sanctionsRepository: SanctionsRepository
  const tenantId = 'test-tenant'

  beforeAll(async () => {
    client = await getMongoDbClient()
    const db = client.db()

    await createTenantDatabase('flagright')

    sanctionsRepository = new ClickhouseSanctionsRepository()
    searchCollection = db.collection(
      SANCTIONS_PROVIDER_SEARCHES_COLLECTION(tenantId)
    )

    await sanctionsRepository.save(
      'dowjones',
      [
        [
          'add',
          {
            id: '1',
            entityType: 'person',
            name: 'John Doe',
            countryCodes: ['US'],
            yearOfBirth: '1980',
          },
        ],
        [
          'add',
          {
            id: '2',
            entityType: 'person',
            name: 'Jane Smith',
            countryCodes: ['GB'],
            yearOfBirth: '1985',
          },
        ],
      ],
      '24-08'
    )
  })

  afterAll(async () => {
    const client = await getClickhouseClient('flagright')
    await client.command({
      query: 'truncate table sanctions_data',
    })
  })

  test('search should return the correct results', async () => {
    await withContext(
      async () => {
        const testCases: {
          name: string
          records: SanctionsEntity[]
          request: SanctionsSearchRequest
          expectedIds: string[]
        }[] = [
          {
            name: 'No results returned when no fuzziness',
            records: [
              {
                id: '3',
                entityType: 'person',
                name: 'Osama Bin Laden',
              },
            ],
            request: {
              searchTerm: 'Osama',
              fuzzinessRange: {
                upperBound: 0,
              },
            },
            expectedIds: [],
          },
          {
            name: 'Results returned with fuzziness upperbound',
            records: [
              {
                id: '1',
                entityType: 'person',
                name: 'Osama Bin Laden',
              },
              {
                id: '2',
                entityType: 'person',
                name: 'Vladmir Putin',
              },
            ],
            request: {
              searchTerm: 'Osama Bin Lad',
              fuzzinessRange: {
                upperBound: 25,
              },
            },
            expectedIds: ['1'],
          },
          {
            name: 'Results returned with fuzziness',
            records: [
              {
                id: '1',
                entityType: 'person',
                name: 'Osama Bin Laden',
              },
              {
                id: '2',
                entityType: 'person',
                name: 'Vladmir Putin',
              },
            ],
            request: {
              searchTerm: 'Osama Bin Lad',
              fuzziness: 0.25,
            },
            expectedIds: ['1'],
          },
          {
            name: 'Only exact results returned with no fuzziness',
            records: [
              {
                id: '1',
                entityType: 'person',
                name: 'Osama Bin Laden',
              },
              {
                id: '2',
                entityType: 'person',
                name: 'Vladmir Putin',
              },
            ],
            request: {
              searchTerm: 'Osama Bin Laden',
              fuzzinessRange: {
                upperBound: 0,
              },
            },
            expectedIds: ['1'],
          },
          {
            name: 'Result returned for AKA',
            records: [
              {
                id: '1',
                entityType: 'person',
                name: 'Normal Person',
                aka: ['Osama Bin Laden'],
              },
              {
                id: '2',
                entityType: 'person',
                name: 'Vladmir Putin',
              },
            ],
            request: {
              searchTerm: 'Osama Bin Laden',
              fuzzinessRange: {
                upperBound: 25,
              },
            },
            expectedIds: ['1'],
          },
          {
            name: 'Result is scoped by other parameters',
            records: [
              {
                id: '10',
                entityType: 'person',
                name: 'Normal Person',
                yearOfBirth: '1991',
                countryCodes: ['GB'],
                nationality: ['AD'],
                gender: 'M',
                sanctionSearchTypes: ['PEP'],
                occupations: [
                  {
                    rank: 'LEVEL_3',
                    occupationCode:
                      'heads_and_deputies_state_national_government',
                  },
                ],
                documents: [
                  {
                    id: '12345',
                    formattedId: '5-4-3-2-1',
                  },
                ],
              },
              {
                id: '2',
                entityType: 'person',
                name: 'Vladmir Putin',
              },
            ],
            request: {
              searchTerm: 'Normal Person',
              countryCodes: ['GB'],
              yearOfBirth: 1991,
              documentId: ['12345', '5-4-3-2-1'],
              occupationCode: ['heads_and_deputies_state_national_government'],
              nationality: ['AD'],
              gender: 'M',
              types: ['PEP'],
              PEPRank: 'LEVEL_3',
              fuzzinessRange: {
                upperBound: 25,
              },
            },
            expectedIds: ['10'],
          },
        ]

        for (const tc of testCases) {
          await sanctionsRepository.save(
            'dowjones',
            tc.records.map((r) => ['add', r]),
            '24-08'
          )

          const sanctionsFetcher = new TestSanctionsDataFetcher()
          const searchResult = await sanctionsFetcher.search(tc.request)

          expect(searchResult.data?.length).toBe(tc.expectedIds.length)
          expect(searchResult.data?.map((s) => s.id).sort()).toStrictEqual(
            tc.expectedIds.sort()
          )
          const client = await getClickhouseClient('flagright')
          await client.command({
            query: 'truncate table sanctions_data',
          })
        }
      },
      { tenantId }
    )
  })

  test('getSearch should return stored search result', async () => {
    await withContext(
      async () => {
        const sanctionsFetcher = new TestSanctionsDataFetcher()

        const providerSearchId = 'test-provider-id'

        // Manually insert a search result to simulate a stored search
        await searchCollection.insertOne({
          providerSearchId,
          hitsCount: 1,
          data: [{ id: '4', entityType: 'person', name: 'Jane Smith' }],
          createdAt: new Date().getTime(),
        })

        const searchResult = await sanctionsFetcher.getSearch(providerSearchId)
        expect(searchResult.providerSearchId).toBe(providerSearchId)
        expect(searchResult.data && searchResult.data[0].name).toBe(
          'Jane Smith'
        )
      },
      { tenantId }
    )
  })

  test('deleteSearch should remove the search from the collection', async () => {
    await withContext(
      async () => {
        const sanctionsFetcher = new TestSanctionsDataFetcher()

        const providerSearchId = 'delete-test-id'
        await searchCollection.insertOne({
          providerSearchId,
          hitsCount: 1,
          data: [{ id: '7', entityType: 'person', name: 'John Doe' }],
          createdAt: new Date().getTime(),
        })

        // Verify it exists
        const searchResult = await sanctionsFetcher.getSearch(providerSearchId)
        expect(searchResult.providerSearchId).toBe(providerSearchId)

        // Delete the search
        await sanctionsFetcher.deleteSearch(providerSearchId)

        // Verify it no longer exists
        await expect(
          sanctionsFetcher.getSearch(providerSearchId)
        ).rejects.toThrow(`Search not found for ${providerSearchId}`)
      },
      { tenantId }
    )
  })

  test('setMonitoring should update the monitoring field', async () => {
    await withContext(
      async () => {
        const sanctionsFetcher = new TestSanctionsDataFetcher()

        const providerSearchId = 'monitoring-test-id'
        await searchCollection.insertOne({
          providerSearchId,
          hitsCount: 1,
          data: [{ id: '30', entityType: 'person', name: 'Jane Smith' }],
          createdAt: new Date().getTime(),
          monitor: false,
        })

        // Set monitoring to true
        await sanctionsFetcher.setMonitoring(providerSearchId, true)

        const updatedSearch = await searchCollection.findOne({
          providerSearchId,
        })
        expect(updatedSearch?.monitor).toBe(true)
      },
      { tenantId }
    )
  })

  test('updateMonitoredSearches should trigger searches for monitored items', async () => {
    await withContext(
      async () => {
        const sanctionsFetcher = new TestSanctionsDataFetcher()

        // Insert a monitored search
        await searchCollection.insertOne({
          providerSearchId: 'monitored-search',
          monitor: true,
          request: {
            searchTerm: 'John Doe',
            countryCodes: ['US'],
            yearOfBirth: 1980,
          },
          hitsCount: 0,
          data: [],
          createdAt: new Date().getTime(),
        })

        const searchSpy = jest.spyOn(sanctionsFetcher, 'search')
        await sanctionsFetcher.updateMonitoredSearches()

        expect(searchSpy).toHaveBeenCalled()
        expect(searchSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            searchTerm: 'John Doe',
            existingProviderId: 'monitored-search',
          })
        )
      },
      { tenantId }
    )
  })
})
