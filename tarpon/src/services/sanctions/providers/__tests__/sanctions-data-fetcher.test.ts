import { MongoClient, Collection } from 'mongodb'
import { intersection, sample } from 'lodash'
import { sanitizeString } from '@flagright/lib/utils/string'
import { SanctionsDataFetcher } from '../sanctions-data-fetcher'
import data from './ongoing_search_results.json'
import { SanctionsDataProviders } from '@/services/sanctions/types'
import { SanctionsEntity } from '@/@types/openapi-internal/SanctionsEntity'
import { SanctionsProviderResponse } from '@/services/sanctions/providers/types'
import { getMongoDbClient, getMongoDbClientDb } from '@/utils/mongodb-utils'
import { getContext } from '@/core/utils/context-storage'
import {
  SANCTIONS_COLLECTION,
  SANCTIONS_PROVIDER_SEARCHES_COLLECTION,
} from '@/utils/mongodb-definitions'
import { SanctionsSearchRequest } from '@/@types/openapi-internal/SanctionsSearchRequest'
import { withFeatureHook } from '@/test-utils/feature-test-utils'

withFeatureHook(['SANCTIONS', 'DOW_JONES'])
// Mock getContext
jest.mock('@/core/utils/context-storage', () => ({
  getContext: jest.fn(),
}))

// Extend the SanctionsDataFetcher for testing purposes
class TestSanctionsDataFetcher extends SanctionsDataFetcher {
  constructor(tenantId: string) {
    super(SanctionsDataProviders.DOW_JONES, tenantId)
  }
  // Implement abstract methods as no-op for this test
  async fullLoad() {}
  async delta() {}

  // Mock the `search` function since $search is only available on Mongo Atlas
  async search(
    _request: SanctionsSearchRequest
  ): Promise<SanctionsProviderResponse> {
    return {
      providerSearchId: 'mock-provider-id',
      hitsCount: 1,
      data: [
        {
          id: '4',
          entityType: 'PERSON',
          name: 'John Doe',
          countryCodes: ['US'],
          yearOfBirth: ['1980'],
        },
      ],
      createdAt: new Date().getTime(),
    }
  }
}

describe('SanctionsDataFetcher Integration Tests', () => {
  let client: MongoClient
  let sanctionsCollection: Collection<SanctionsEntity>
  let searchCollection: Collection<SanctionsProviderResponse>

  beforeAll(async () => {
    ;(getContext as jest.Mock).mockReturnValue({ tenantId: 'test-tenant' })

    // Start in-memory MongoDB instance
    client = await getMongoDbClient()
    const db = client.db()

    sanctionsCollection = db.collection(SANCTIONS_COLLECTION('test-tenant'))
    searchCollection = db.collection(
      SANCTIONS_PROVIDER_SEARCHES_COLLECTION('test-tenant')
    )

    // Seed some data
    await sanctionsCollection.insertMany([
      {
        id: '1',
        entityType: 'PERSON',
        name: 'John Doe',
        countryCodes: ['US'],
        yearOfBirth: ['1980'],
      },
      {
        id: '1',
        entityType: 'PERSON',
        name: 'Jane Smith',
        countryCodes: ['GB'],
        yearOfBirth: ['1985'],
      },
    ])
  })

  afterAll(async () => {
    await sanctionsCollection.drop()
  })

  test('setMonitoring should update the monitoring field', async () => {
    const sanctionsFetcher = new TestSanctionsDataFetcher('test-tenant')

    const providerSearchId = 'monitoring-test-id'
    await searchCollection.insertOne({
      providerSearchId,
      hitsCount: 1,
      data: [{ id: '30', entityType: 'PERSON', name: 'Jane Smith' }],
      createdAt: new Date().getTime(),
      monitor: false,
    })

    // Set monitoring to true
    await sanctionsFetcher.setMonitoring(providerSearchId, true)

    const updatedSearch = await searchCollection.findOne({ providerSearchId })
    expect(updatedSearch?.monitor).toBe(true)
  })

  test('search should return results with 100 fuzziness', async () => {
    const screeningEntities = data
      .map((entity) => JSON.parse(entity.data))
      .filter(
        (entity) =>
          entity.documents?.length && entity.sanctionSearchTypes?.length
      )
      .slice(0, 10)

    await sanctionsCollection.insertMany(screeningEntities)
    const db = await getMongoDbClientDb()
    const randomEntity1 = sample(screeningEntities)
    const sanctionsFetcher = new TestSanctionsDataFetcher('test-tenant')
    const searchResult1 = await sanctionsFetcher.searchWithoutMatchingNames(
      {
        searchTerm: randomEntity1.name,
        documentId: randomEntity1.documents?.map((doc) => doc.formattedId),
        types: randomEntity1.sanctionSearchTypes,
        allowDocumentMatches: true,
      },
      db
    )
    expect(searchResult1.data?.length).toBeGreaterThan(0)
    const resultDocumentIds = searchResult1.data?.map((result) =>
      result.documents?.map((doc) => doc.formattedId)
    )
    expect(
      resultDocumentIds?.every(
        (ids) =>
          intersection(
            ids,
            randomEntity1.documents?.map((doc) => doc.formattedId)
          ).length > 0
      )
    ).toBe(true)
    expect(
      searchResult1.data?.every(
        (result) =>
          intersection(
            result.sanctionSearchTypes,
            randomEntity1.sanctionSearchTypes
          ).length > 0
      )
    ).toBe(true)

    const randomEntity2 = sample(screeningEntities)
    const searchResult2 = await sanctionsFetcher.searchWithoutMatchingNames(
      {
        searchTerm: randomEntity2.name,
        documentId: randomEntity2.documents?.map((doc) => doc.formattedId),
        types: randomEntity2.sanctionSearchTypes,
        allowDocumentMatches: true,
      },
      db
    )
    expect(searchResult2.data?.length).toBeGreaterThan(0)
    const resultDocumentIds2 = searchResult2.data?.map((result) =>
      result.documents?.map((doc) => doc.formattedId)
    )
    expect(
      resultDocumentIds2?.every(
        (ids) =>
          intersection(
            ids,
            randomEntity2.documents?.map((doc) => doc.formattedId)
          ).length > 0
      )
    ).toBe(true)
    expect(
      searchResult2.data?.every(
        (result) =>
          intersection(
            result.sanctionSearchTypes,
            randomEntity2.sanctionSearchTypes
          ).length > 0
      )
    ).toBe(true)

    const searchResult3 = await sanctionsFetcher.searchWithoutMatchingNames(
      {
        searchTerm: 'Rajesh Kumar',
        documentId: ['test-to-not-match'],
        types: ['ADVERSE_MEDIA'],
        allowDocumentMatches: true,
      },
      db
    )
    expect(searchResult3.data?.length).toBe(0)
  })

  test('remove stopwords from search term', async () => {
    const data = {
      stopwords: [
        'bin.',
        'bin',
        'b.',
        'binti',
        'binti.',
        'bt',
        'bt.',
        'bte',
        'bte.',
        'a/l',
        'al',
        'a/p',
        'ap',
        'anak',
        'ak',
        'ak.',
        's/o',
        'so',
        'd/o',
        'do',
        'bn',
        'bti',
        'bnti',
        'b',
        'mr.',
        'miss',
      ],
      names: [
        'AIZA AISYAH BINTI SABRI',
        'ANGELA A/P NANGGAU',
        'SURIA SONIA AHIP ABDULLAH',
        'SITI SAMAH BTE ANGKONG',
        'NUR AZIZAH AK YUSOK',
        'YEW JIA YI @ LIAW JIA YI',
        'LEE YU ER',
        'JOEMNAH @ ELLVIAH BINTI SANADON',
        'NORJIJAH MAKOPIN',
        'FLORENCE ANAK JANGAN',
        'MAG DALENA BIDANG ANAK JUGAH',
        'PUGANESHWARI A/P RAJU',
        'MANJULA MANI',
        'SHAHIRA BINTI SAIP',
        'ABIGAIL THIEN MAY-JIUAN',
        'VIEZYECI HEBRON',
        'SUCHADA OUI HUI QING',
        'MANORD A/L AI RONG',
        'BINTILANI BIN BANNAHARI',
        'MADRUS BIN HAJI IBRAHIM',
        'NATHANIEL NOEL ANAK ANDREW LIBIS',
        'MACKRISLANCE CADELAC ANAK SIWEN',
        'MOHD SHAHRILLIZEM BIN MUJIN',
        'AHMAD B HJ TAZIROH',
        'DAYRYL LIANON @ FRANCIS',
        'PHILLIP YOMORONG',
        'MUHAMMAD HARIS ARIFFIN BIN BAH HAU',
        'BONIFACE ABUN ANAK GERANG',
        'NGADAMIN BIN MAT YASIR',
        'Mr.  Donald Trump',
        'Miss Sonia gandhi',
        'SYLVIA BINTI.TATI @ SHEILA EMILY SITAIM',
      ],
      result: [
        'aiza aisyah sabri',
        'angela nanggau',
        'suria sonia ahip abdullah',
        'siti samah angkong',
        'nur azizah yusok',
        'yew jia yi liaw jia yi',
        'lee yu er',
        'joemnah ellviah sanadon',
        'norjijah makopin',
        'florence jangan',
        'mag dalena bidang jugah',
        'puganeshwari raju',
        'manjula mani',
        'shahira saip',
        'abigail thien may jiuan',
        'viezyeci hebron',
        'suchada oui hui qing',
        'manord ai rong',
        'bintilani bannahari',
        'madrus haji ibrahim',
        'nathaniel noel andrew libis',
        'mackrislance cadelac siwen',
        'mohd shahrillizem mujin',
        'ahmad hj taziroh',
        'dayryl lianon francis',
        'phillip yomorong',
        'muhammad haris ariffin bah hau',
        'boniface abun gerang',
        'ngadamin mat yasir',
        'donald trump',
        'sonia gandhi',
        'sylvia tati sheila emily sitaim',
      ],
    }
    const sanctionsFetcher = new TestSanctionsDataFetcher('test-tenant')
    const stopwordSet = new Set(data.stopwords)
    for (let index = 0; index < data.names.length; index++) {
      const name = data.names[index]
      const modifiedTerm = sanctionsFetcher
        .processNameWithStopwords(name, stopwordSet)
        .toLowerCase()
        .trim()
      const searchTerm = sanitizeString(modifiedTerm, true)
      expect(searchTerm).toBe(data.result[index])
    }
  })

  describe('Short Name Matching', () => {
    test('should match short names with one character difference when enabled', () => {
      const request: SanctionsSearchRequest = {
        searchTerm: 'Kevin',
        fuzziness: 0.15,
        enableShortNameMatching: true,
      }

      // Test with one character difference (20% dissimilarity for 5 characters)
      const result1 = SanctionsDataFetcher.getFuzzinessEvaluationResult(
        request,
        80 // 80% similarity means 1 character difference for "Kevin"
      )
      expect(result1).toBe(true)

      // Test with two character differences (40% dissimilarity for 5 characters)
      const result2 = SanctionsDataFetcher.getFuzzinessEvaluationResult(
        request,
        60 // 60% similarity means 2 character differences for "Kevin"
      )
      expect(result2).toBe(false)
    })

    test('should not apply short name matching when disabled', () => {
      const request: SanctionsSearchRequest = {
        searchTerm: 'Kevin',
        fuzziness: 0.15,
        enableShortNameMatching: false,
      }

      // Test with one character difference
      const result = SanctionsDataFetcher.getFuzzinessEvaluationResult(
        request,
        80 // 80% similarity means 1 character difference for "Kevin"
      )
      expect(result).toBe(false)
    })

    test('should handle different name lengths correctly', () => {
      const request: SanctionsSearchRequest = {
        searchTerm: 'John',
        fuzziness: 0.15,
        enableShortNameMatching: true,
      }

      // Test with one character difference in a short name (25% dissimilarity for 4 characters)
      const result1 = SanctionsDataFetcher.getFuzzinessEvaluationResult(
        request,
        75 // 75% similarity means 1 character difference for "John"
      )
      expect(result1).toBe(true)

      // Test with one character difference in a longer name that is *above* the floor
      const request2: SanctionsSearchRequest = {
        ...request,
        searchTerm: 'Christopher', // length 11, above floor of 6
      }
      // 1-char diff is ~9% dissimilarity (1/11), which is within the 15% fuzziness
      const result2 = SanctionsDataFetcher.getFuzzinessEvaluationResult(
        request2,
        90.9
      )
      expect(result2).toBe(true)

      // 2-char diff is ~18% dissimilarity (2/11), which is outside the 15% fuzziness
      const result3 = SanctionsDataFetcher.getFuzzinessEvaluationResult(
        request2,
        81.8
      )
      expect(result3).toBe(false)
    })

    test('should handle fuzziness floor boundary correctly', () => {
      // With 15% fuzziness, floor should be 6. Names with length <= 6 use the special rule.
      const request: SanctionsSearchRequest = {
        searchTerm: 'Thomas', // length 6, exactly at the floor
        fuzziness: 0.15,
        enableShortNameMatching: true,
      }

      // Test with a name AT the floor boundary (should use short name rule: 1 mismatch allowed)
      const result1 = SanctionsDataFetcher.getFuzzinessEvaluationResult(
        request,
        83.33 // 16.67% dissimilarity -> ~1 char diff for length 6 -> Math.round -> 1. Match.
      )
      expect(result1).toBe(true)

      // Test with a name JUST ABOVE the floor (should use standard percentage rule)
      const request2: SanctionsSearchRequest = {
        ...request,
        searchTerm: 'Thomas1', // 7 characters, just above the floor
      }
      // 1-char diff is ~14.3% dissimilarity (1/7), which is inside the 15% fuzziness.
      const result2 = SanctionsDataFetcher.getFuzzinessEvaluationResult(
        request2,
        85.71
      )
      expect(result2).toBe(true) // This should match based on the standard fuzziness rule.
    })

    test('should handle Levenshtein matching with 12% fuzziness correctly', () => {
      // Test 1: Zulfikar (8 chars) with 1 mismatch should match
      const request1: SanctionsSearchRequest = {
        searchTerm: 'Zulfikar',
        fuzziness: 0.12,
        enableShortNameMatching: true,
      }
      const result1 = SanctionsDataFetcher.getFuzzinessEvaluationResult(
        request1,
        87.5 // 1 char diff in 8 chars = 12.5% dissimilarity
      )
      expect(result1).toBe(true)

      // Test 2: Zulfikar (8 chars) with 2 mismatches should not match
      const result2 = SanctionsDataFetcher.getFuzzinessEvaluationResult(
        request1,
        75 // 2 char diff in 8 chars = 25% dissimilarity
      )
      expect(result2).toBe(false)

      // Test 3: Zhen Liu (8 chars) with 1 mismatch should match
      const request3: SanctionsSearchRequest = {
        searchTerm: 'Zhen Liu',
        fuzziness: 0.12,
        enableShortNameMatching: true,
      }
      const result3 = SanctionsDataFetcher.getFuzzinessEvaluationResult(
        request3,
        87.5 // 1 char diff in 8 chars = 12.5% dissimilarity
      )
      expect(result3).toBe(true)
    })

    test('should handle Tokenized matching with 10% fuzziness correctly', () => {
      // Test 4: Inc Group (9 chars) with 1 mismatch should match
      const request1: SanctionsSearchRequest = {
        searchTerm: 'Inc Group',
        fuzziness: 0.1,
        enableShortNameMatching: true,
      }
      const result1 = SanctionsDataFetcher.getFuzzinessEvaluationResult(
        request1,
        88.89 // 1 char diff in 9 chars = 11.11% dissimilarity
      )
      expect(result1).toBe(true)

      // Test 5: Mal Corp. (9 chars) with 1 mismatch should match
      const request2: SanctionsSearchRequest = {
        searchTerm: 'Mal Corp.',
        fuzziness: 0.1,
        enableShortNameMatching: true,
      }
      const result2 = SanctionsDataFetcher.getFuzzinessEvaluationResult(
        request2,
        88.89 // 1 char diff in 9 chars = 11.11% dissimilarity
      )
      expect(result2).toBe(true)

      // Test 6: Bonifacy (8 chars) with 1 mismatch should match
      const request3: SanctionsSearchRequest = {
        searchTerm: 'Bonifacy',
        fuzziness: 0.1,
        enableShortNameMatching: true,
      }
      const result3 = SanctionsDataFetcher.getFuzzinessEvaluationResult(
        request3,
        87.5 // 1 char diff in 8 chars = 12.5% dissimilarity
      )
      expect(result3).toBe(true)
    })
  })
})
