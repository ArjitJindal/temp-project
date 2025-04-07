import path from 'path'
import axios from 'axios'
import { DowJonesProvider } from '@/services/sanctions/providers/dow-jones-provider'
import { SanctionsRepository } from '@/services/sanctions/providers/types'
import { SanctionsEntity } from '@/@types/openapi-internal/SanctionsEntity'
import { DOW_JONES_SANCTIONS_SEARCH_TYPES } from '@/@types/openapi-internal-custom/DowJonesSanctionsSearchType'
import { SANCTIONS_ENTITY_TYPES } from '@/@types/openapi-internal-custom/SanctionsEntityType'

jest.mock('axios')
jest.mock('unzipper')
jest.mock('fs-extra')

describe('DowJonesProvider', () => {
  let fetcher: DowJonesProvider
  let repo: SanctionsRepository

  beforeEach(async () => {
    fetcher = new DowJonesProvider(
      'testuser',
      'testpass',
      'test',
      DOW_JONES_SANCTIONS_SEARCH_TYPES,
      SANCTIONS_ENTITY_TYPES
    )
    repo = {
      save: jest.fn(),
      saveAssociations: jest.fn(),
    } as unknown as SanctionsRepository
  })

  it('should fetch and parse file paths from the API', async () => {
    const mockResponse = { data: 'file1.zip,file2.zip' }
    ;(axios.get as jest.Mock).mockResolvedValue(mockResponse)

    const filePaths = await fetcher.getFilePaths()

    expect(filePaths).toEqual(['file1.zip', 'file2.zip'])
    expect(axios.get).toHaveBeenCalledWith(
      'https://djrcfeed.dowjones.com/xml',
      {
        headers: {
          Authorization: fetcher.authHeader,
          'Content-Type': 'application/xml',
        },
      }
    )
  })
  it('should process single file archive', async () => {
    const filePath = path.resolve(__dirname, 'data/dowjones_single')
    await fetcher.processSingleFile(repo, '2024-02', filePath)
    fetcher = new DowJonesProvider(
      'testuser',
      'testpass',
      'test',
      DOW_JONES_SANCTIONS_SEARCH_TYPES,
      ['PERSON']
    )
    expect(repo.save).toHaveBeenCalledWith(
      'dowjones',
      [
        [
          'chg',
          {
            id: '11756174',
            name: 'priyavrat bhartia',
            sanctionSearchTypes: ['ADVERSE_MEDIA'], // RCAs are not sanctions
            entityType: 'PERSON',
            gender: 'Male',
            isActivePep: true,
            isActiveSanctioned: false,
            aka: [],
            countries: ['India'],
            countryCodes: ['IN'],
            matchTypes: ['Organised Crime'],
            dateMatched: true,
            nationality: ['IN'],
            normalizedAka: [],
            profileImagesUrls: [
              'http://www.jubl.com/Uploads/image/471imguf_Priyavrat_Bhartia.jpg',
              'http://www.digicontent.co.in/wp-content/uploads/2021/08/priyavrat-bhartia.jpg',
            ],
            documents: [
              {
                name: 'Others',
                formattedId: '20603',
                id: '20603',
              },
            ],
            freetext: `ASSOCIATED ENTITIES INFORMATION:
Hindustan Media Ventures Limited
HT Media Limited
Jubilant Industries Ltd.
Jubilant Life Sciences Limited
Psb Trustee Company Private Limited
Sb Trusteeship Services Private Limited
Jubilant Enpro Private Limited
Digicontent Limited
Bridge School Of Management
Shobhana Communications Llp
Burda Druck India Private Limited
Earthstone Holding (Three) Private Limited
Priyavrat Computers Llp
Ht Mobile Solutions Limited
Htl Computers Service Private Limited
Hindustan Times Media Limited
Jubilant Agri & Consumer Products Ltd
The Hindustan Times Limited
Jubilant Realty Private Limited
Ssbpb Investment Holding Private Limited
Digicontent Ltd
Jubilant Ingrevia Ltd.
Jubilant Pharmova Ltd.`,
            types: ['Special Interest Person (SIP) - Organised Crime'],
            yearOfBirth: ['1976'],
            dateOfBirths: ['1976-10-04'],
          },
        ],
      ],
      '2024-02'
    )
    expect(repo.saveAssociations).toHaveBeenCalledWith(
      'dowjones',
      [
        [
          '11756174',
          [
            {
              id: '151775',
              association: '18',
            },
            {
              association: '7',
              id: '790369',
            },
          ],
        ],
      ],
      '2024-02'
    )
  })
  it('should process split file archive', async () => {
    const filePath = path.resolve(__dirname, 'data/dowjones_splits')
    await fetcher.processSplitArchive(repo, '2024-02', filePath)
    fetcher = new DowJonesProvider(
      'testuser',
      'testpass',
      'test',
      DOW_JONES_SANCTIONS_SEARCH_TYPES,
      SANCTIONS_ENTITY_TYPES
    )
    expect(repo.save).toHaveBeenCalledWith(
      'dowjones',
      [
        [
          'add',
          {
            id: '10183',
            name: 'ange-felix patasse',
            entityType: 'PERSON',
            nationality: ['CF'],
            sanctionSearchTypes: ['PEP', 'ADVERSE_MEDIA'], // only sanctions list mapped person in sanction
            isActivePep: false,
            isActiveSanctioned: false,
            gender: 'Male',
            occupations: [
              {
                occupationCode: 'political_party_officials',
                rank: 'LEVEL_1',
                title: 'Deceased',
              },
            ],

            profileImagesUrls: [
              'http://rcainfo.mondoblog.org/files/2011/05/patasse-photo.jpg',
              'https://cdn-s-www.estrepublicain.fr/images/F0DDA775-5B37-4A03-969B-363BC9E96EBB/NW_detail_M/title-1576680650.jpg',
              'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRopsmW70IMhJgZj3_-f2bQhkpaDJKH_WdqPg&usqp=CAU',
            ],
            types: [
              'Politically Exposed Person (PEP)',
              'Special Interest Person (SIP) - Corruption',
            ],
            aka: [
              'ange félix patassé',
              'ange felix patasse',
              'ange-félix patassé',
            ],
            normalizedAka: ['ange felix patasse'],
            freetext: `PROFILE CREATED: 28-Aug-2006
UPDATE ADDED: 05-Sep-2006
UPDATE ADDED: 07-Jun-2022
Keywords: embezzlement, fraud
People mentioned: Ange-Felix Patasse
Profile:
Ange-Felix Patasse, former president of the Central African Republic, was ordered to stand trial in absentia from August 7 to September 8, 2006, for embezzlement of public funds and fraud. Patasse, who was deposed from office in March 2003 and lived in exile in Togo, was scheduled to be tried alongside four other individuals. 

PROFILE UPDATED: 05-Sep-2006
On August 30, 2006, the Criminal Court of Bangui sentenced Patasse in absentia to 20 years of hard labour on charges of fraud. He was also ordered to pay a fine of XAF 6m (approx. EUR 9,100) and XAF 7bn (EUR 10.7m) in damages plus interest, and was deprived of his civil rights.

PROFILE UPDATED: 07-jun-2022
Patasse passed away on April 5, 2011.`,
            countries: ['Central African Republic'],
            countryCodes: ['CF'],
            documents: [
              {
                id: 'D00002264',
                name: 'Passport No.',
                formattedId: 'D00002264',
              },
              {
                id: 'M4800002143743',
                name: 'Others',
                formattedId: 'M4800002143743',
              },
              {
                id: 'CAR',
                name: 'OFAC Program ID',
                formattedId: 'CAR',
              },
              {
                name: 'OFAC Unique ID',
                formattedId: '16723',
                id: '16723',
              },
              {
                id: 'CAF',
                name: 'EU Sanctions Programme Indicator',
                formattedId: 'CAF',
              },
              {
                id: '7355',
                name: 'EU Consolidated Electronic List ID',
                formattedId: '7355',
              },
              {
                id: 'CFi.001',
                name: 'UN Permanent Reference No.',
                formattedId: 'CFi.001',
              },
              {
                formattedId: '12998',
                id: '12998',
                name: 'HM Treasury Group ID',
              },
              {
                formattedId: '27651',
                id: '27651',
                name: 'SECO SSID',
              },
              {
                formattedId: '2673',
                id: '2673',
                name: 'DFAT Reference Number',
              },
              {
                id: 'CAF0003',
                name: 'UK Sanctions List Unique ID',
                formattedId: 'CAF0003',
              },
              {
                id: 'The Central African Republic (Sanctions) (EU Exit) Regulations 2020',
                name: 'UK Sanctions List Regime',
                formattedId:
                  'The Central African Republic (Sanctions) (EU Exit) Regulations 2020',
              },
              {
                id: 'Central African Republic',
                name: 'HM Treasury Regime',
                formattedId: 'Central African Republic',
              },
            ],
            yearOfBirth: ['1937'],
            dateOfBirths: ['1937-01-25'],
            dateMatched: true,
            matchTypes: ['PEP', 'Corruption'],
            screeningSources: [
              {
                createdAt: 1026518400000,
                name: 'Associated Press Newswires',
                url: 'https://global.factiva.com/redir/default.aspx?P=sa&AN=aprs000020020713dy7d00x13&cat=a&ep=ASE',
                fields: [
                  {
                    name: 'URL',
                    values: [
                      'https://global.factiva.com/redir/default.aspx?P=sa&AN=aprs000020020713dy7d00x13&cat=a&ep=ASE',
                    ],
                  },
                ],
              },
              {
                createdAt: 1162252800000,
                name: 'Global Insight Daily Analysis',
                url: 'https://global.factiva.com/redir/default.aspx?P=sa&AN=WDAN000020061031e2av0003b&cat=a&ep=ASE',
                fields: [
                  {
                    name: 'URL',
                    values: [
                      'https://global.factiva.com/redir/default.aspx?P=sa&AN=WDAN000020061031e2av0003b&cat=a&ep=ASE',
                    ],
                  },
                ],
              },
              {
                createdAt: 1156636800000,
                name: 'All Africa',
                url: 'https://global.factiva.com/redir/default.aspx?P=sa&AN=AFNWSF0020060831e28v000ci&cat=a&ep=ASE',
                fields: [
                  {
                    name: 'URL',
                    values: [
                      'https://global.factiva.com/redir/default.aspx?P=sa&AN=AFNWSF0020060831e28v000ci&cat=a&ep=ASE',
                    ],
                  },
                ],
              },
              {
                createdAt: 1154908800000,
                name: 'All Africa',
                url: 'https://global.factiva.com/redir/default.aspx?P=sa&AN=AFNWSF0020060807e287000eh&cat=a&ep=ASE',
                fields: [
                  {
                    name: 'URL',
                    values: [
                      'https://global.factiva.com/redir/default.aspx?P=sa&AN=AFNWSF0020060807e287000eh&cat=a&ep=ASE',
                    ],
                  },
                ],
              },
              {
                createdAt: 1154908800000,
                name: 'Global Insight Daily Analysis',
                url: 'https://global.factiva.com/redir/default.aspx?P=sa&AN=WDAN000020060803e2830003h&cat=a&ep=ASE',
                fields: [
                  {
                    name: 'URL',
                    values: [
                      'https://global.factiva.com/redir/default.aspx?P=sa&AN=WDAN000020060803e2830003h&cat=a&ep=ASE',
                    ],
                  },
                ],
              },
              {
                createdAt: 1301961600000,
                name: 'Agence France Presse',
                url: 'https://global.factiva.com/redir/default.aspx?P=sa&AN=AFPR000020110405e745006vc&cat=a&ep=ASE',
                fields: [
                  {
                    name: 'URL',
                    values: [
                      'https://global.factiva.com/redir/default.aspx?P=sa&AN=AFPR000020110405e745006vc&cat=a&ep=ASE',
                    ],
                  },
                ],
              },
              {
                createdAt: 1156809600000,
                name: 'Agence France Presse',
                url: 'https://global.factiva.com/redir/default.aspx?P=sa&AN=AFPR000020060829e28t003lr&cat=a&ep=ASE',
                fields: [
                  {
                    name: 'URL',
                    values: [
                      'https://global.factiva.com/redir/default.aspx?P=sa&AN=AFPR000020060829e28t003lr&cat=a&ep=ASE',
                    ],
                  },
                ],
              },
            ],
          },
        ],
        [
          'add',
          {
            id: '10184',
            isActivePep: true,
            isActiveSanctioned: false,
            name: 'martin ziguele',
            entityType: 'PERSON',
            gender: 'Male',
            documents: [],
            nationality: ['CF'],
            normalizedAka: ['martin zinguele'],
            occupations: [
              {
                occupationCode: 'members_of_the_national_legislature',
                rank: 'LEVEL_1',
                title: 'Member, National Assembly, MLPC, Bocaranga 3',
              },
              {
                occupationCode: 'political_party_officials',
                rank: 'LEVEL_1',
                title:
                  "President, Central African People's Liberation Movement (MLPC)",
              },
            ],
            profileImagesUrls: [
              'http://www.alwihdainfo.com/photo/art/grande/6418242-9683160.jpg',
              'https://www.jeuneafrique.com/medias/2018/04/23/vf14120117400000-592x296-1524478838.jpg',
              'https://www.jeuneafrique.com/medias/2020/08/26/jad20200826-ass-conf-centreafrique-zinguele-640x320-1598521402.jpg',
            ],
            dateMatched: true,
            matchTypes: ['PEP'],
            sanctionSearchTypes: ['PEP'],
            aka: ['martin zinguélé', 'martin zinguele', 'martin ziguélé'],
            countries: ['Central African Republic'],
            countryCodes: ['CF'],
            yearOfBirth: ['1957'],
            types: ['Politically Exposed Person (PEP)'],
            dateOfBirths: ['1957-02-12'],
          },
        ],
      ],
      '2024-02'
    )
    expect(repo.saveAssociations).toHaveBeenCalledWith(
      'dowjones',
      [
        [
          '10183',
          [
            { association: '29', id: '10228' },
            { association: '37', id: '10261' },
            { association: '44', id: '10374' },
            { association: '29', id: '10441' },
            { association: '37', id: '170224' },
            { association: '1', id: '171089' },
            { association: '1', id: '212451' },
            { association: '34', id: '469057' },
            { association: '44', id: '841803' },
            { association: '44', id: '841805' },
            { association: '34', id: '2922781' },
            { association: '5', id: '4444238' },
            { association: '5', id: '4444246' },
            { association: '8', id: '4512176' },
            { association: '7', id: '4512177' },
            { association: '5', id: '4542634' },
            { association: '6', id: '4542640' },
            { association: '17', id: '12782575' },
            { association: '16', id: '12782576' },
            { association: '23', id: '12863222' },
          ],
        ],
        [
          '10184',
          [
            { association: '23', id: '731784' },
            { association: '6', id: '3414870' },
            { association: '1', id: '3414873' },
            { association: '5', id: '3414881' },
            { association: '21', id: '3414884' },
            { association: '20', id: '3414885' },
            { association: '6', id: '3414886' },
            { association: '5', id: '3414888' },
            { association: '5', id: '3414889' },
            { association: '6', id: '3414890' },
            { association: '8', id: '3414893' },
            { association: '7', id: '3414896' },
            { association: '4', id: '3414900' },
            { association: '3', id: '3414903' },
            { association: '4', id: '3414905' },
            { association: '4', id: '3414906' },
            { association: '4', id: '3414907' },
            { association: '4', id: '3414909' },
            { association: '3', id: '3414910' },
            { association: '3', id: '3414914' },
            { association: '3', id: '3414915' },
            { association: '3', id: '3414916' },
            { association: '4', id: '3414919' },
            { association: '3', id: '4478578' },
          ],
        ],
      ],
      '2024-02'
    )
  })
})

describe('Sanctions data fetcher', () => {
  describe('Deriving match details', () => {
    test('For unrelated search term there should be no match details', async () => {
      const result = DowJonesProvider.deriveMatchingDetails(
        {
          searchTerm: 'unrelated',
        },
        HIT_WITH_NO_AKA
      )
      expect(result.nameMatches).toEqual([
        {
          match_types: [],
          query_term: 'unrelated',
        },
      ])
    })
    test('For exact match every term should have exact match', async () => {
      const result = DowJonesProvider.deriveMatchingDetails(
        {
          searchTerm: 'Vladimir Putiin',
        },
        HIT_WITH_DUPLICATED_AKA
      )
      expect(result.nameMatches).toEqual([
        {
          match_types: ['exact_match', 'equivalent_name'],
          query_term: 'Vladimir',
        },
        {
          match_types: ['exact_match', 'equivalent_name'],
          query_term: 'Putiin',
        },
      ])
    })
    test('Missing terms should be ignored', async () => {
      const result = DowJonesProvider.deriveMatchingDetails(
        {
          searchTerm: 'Vladimir Vladimirovich Putiin',
        },
        HIT_WITH_NO_AKA
      )
      expect(result.nameMatches).toEqual([
        {
          match_types: ['exact_match'],
          query_term: 'Vladimir',
        },
        { match_types: [], query_term: 'Vladimirovich' },
        {
          match_types: ['exact_match'],
          query_term: 'Putiin',
        },
      ])
    })
    test('Different case match should also be considered as exact match', async () => {
      const result = DowJonesProvider.deriveMatchingDetails(
        {
          searchTerm: 'VLADIMIR PUTIIN',
        },
        HIT_WITH_NO_AKA
      )
      expect(result.nameMatches).toEqual([
        {
          match_types: ['exact_match'],
          query_term: 'VLADIMIR',
        },
        {
          match_types: ['exact_match'],
          query_term: 'PUTIIN',
        },
      ])
    })
    test('Should properly match terms by edit distance', async () => {
      const result = DowJonesProvider.deriveMatchingDetails(
        {
          searchTerm: 'Voladimir Putin',
          fuzzinessRange: {
            lowerBound: 0,
            upperBound: 20,
          },
        },
        HIT_WITH_NO_AKA
      )
      expect(result.nameMatches).toEqual([
        {
          match_types: ['edit_distance'],
          query_term: 'Voladimir',
        },
        {
          match_types: ['edit_distance'],
          query_term: 'Putin',
        },
      ])
    })
    test('Should properly match terms by edit distance in AKA', async () => {
      const result = DowJonesProvider.deriveMatchingDetails(
        {
          searchTerm: 'Vovka Pupka',
          fuzzinessRange: {
            lowerBound: 0,
            upperBound: 20,
          },
        },
        HIT_WITH_AKA
      )
      expect(result.nameMatches).toEqual([
        {
          match_types: ['name_variations_removal'],
          query_term: 'Vovka',
        },
        {
          match_types: ['name_variations_removal'],
          query_term: 'Pupka',
        },
      ])
    })
  })
  describe('Deriving birth year details', () => {
    test('Should properly derive exact birth year match', async () => {
      const result = DowJonesProvider.deriveMatchingDetails(
        {
          searchTerm: 'unrelated',
          yearOfBirth: 1952,
        },
        HIT_WITH_NO_AKA
      )
      expect(result.secondaryMatches).toEqual([
        {
          match_types: ['exact_birth_year_match'],
          query_term: '1952',
        },
      ])
    })
    test('Should properly derive fuzzy birth year match', async () => {
      const result = DowJonesProvider.deriveMatchingDetails(
        {
          searchTerm: 'unrelated',
          yearOfBirth: 1950,
          fuzzinessRange: {
            lowerBound: 0,
            upperBound: 20,
          },
        },
        HIT_WITH_NO_AKA
      )
      expect(result.secondaryMatches).toEqual([
        {
          match_types: ['fuzzy_birth_year_match'],
          query_term: '1950',
        },
      ])
    })
  })
})

const HIT_WITH_NO_AKA: SanctionsEntity = {
  id: 'LIZCQ58HX6MYKMO',
  updatedAt: new Date('2024-06-20T10:09:30Z').getTime(),
  types: ['adverse-media'],
  name: 'Vladimir Putiin',
  entityType: 'PERSON',
  yearOfBirth: ['1952'],
  sanctionsSources: [
    {
      name: 'company AM',
      countryCodes: ['AU', 'CZ'],
    },
  ],
}

const HIT_WITH_DUPLICATED_AKA: SanctionsEntity = {
  id: 'LIZCQ58HX6MYKMO',
  updatedAt: new Date('2024-06-20T10:09:30Z').getTime(),
  types: ['adverse-media'],
  name: 'Vladimir Putiin',
  aka: ['Vladimir Vladimirovich Putiin'],
  entityType: 'PERSON',
  yearOfBirth: ['1952'],
  sanctionsSources: [
    {
      name: 'company AM',
      countryCodes: ['AU', 'CZ'],
    },
  ],
}

const HIT_WITH_AKA: SanctionsEntity = {
  id: 'LIZCQ58HX6MYKMO',
  updatedAt: new Date('2024-06-20T10:09:30Z').getTime(),
  types: ['adverse-media'],
  name: 'Vladimir Putiin',
  entityType: 'PERSON',
  aka: ['Vova Pupa'],
  yearOfBirth: ['1952'],
  sanctionsSources: [
    {
      name: 'company AM',
      countryCodes: ['AU', 'CZ'],
    },
  ],
}
