import { MongoClient, Collection } from 'mongodb'
import { intersection, sample } from 'lodash'
import { sanitizeString } from '@flagright/lib/utils/string'
import { SanctionsDataFetcher } from '../sanctions-data-fetcher'
import data from './ongoing_search_results.json'
import { SanctionsEntity } from '@/@types/openapi-internal/SanctionsEntity'
import { SanctionsProviderResponse } from '@/services/sanctions/providers/types'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import { getContext } from '@/core/utils/context'
import {
  SANCTIONS_COLLECTION,
  SANCTIONS_PROVIDER_SEARCHES_COLLECTION,
} from '@/utils/mongodb-definitions'
import { SanctionsSearchRequest } from '@/@types/openapi-internal/SanctionsSearchRequest'

// Mock getContext
jest.mock('@/core/utils/context', () => ({
  getContext: jest.fn(),
}))

// Extend the SanctionsDataFetcher for testing purposes
class TestSanctionsDataFetcher extends SanctionsDataFetcher {
  constructor(tenantId: string) {
    super('dowjones', tenantId)
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

    const randomEntity1 = sample(screeningEntities)
    const sanctionsFetcher = new TestSanctionsDataFetcher('test-tenant')
    const searchResult1 = await sanctionsFetcher.searchWithoutMatchingNames({
      searchTerm: randomEntity1.name,
      documentId: randomEntity1.documents?.map((doc) => doc.formattedId),
      types: randomEntity1.sanctionSearchTypes,
      allowDocumentMatches: true,
    })
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
    const searchResult2 = await sanctionsFetcher.searchWithoutMatchingNames({
      searchTerm: randomEntity2.name,
      documentId: randomEntity2.documents?.map((doc) => doc.formattedId),
      types: randomEntity2.sanctionSearchTypes,
      allowDocumentMatches: true,
    })
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

    const searchResult3 = await sanctionsFetcher.searchWithoutMatchingNames({
      searchTerm: 'Rajesh Kumar',
      documentId: ['test-to-not-match'],
      types: ['ADVERSE_MEDIA'],
      allowDocumentMatches: true,
    })
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
        'abigail thien may-jiuan',
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
})
