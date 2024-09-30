import path from 'path'
import axios from 'axios'
import { DowJonesProvider } from '@/services/sanctions/providers/dow-jones-provider'
import { SanctionsRepository } from '@/services/sanctions/providers/types'

jest.mock('axios')
jest.mock('unzipper')
jest.mock('fs-extra')

describe('DowJonesProvider', () => {
  let fetcher: DowJonesProvider
  let repo: SanctionsRepository

  beforeEach(async () => {
    fetcher = new DowJonesProvider('testuser', 'testpass')
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
    fetcher = new DowJonesProvider('testuser', 'testpass')
    expect(repo.save).toHaveBeenCalledWith(
      'dowjones',
      [
        [
          'chg',
          {
            id: '11756174',
            name: 'Priyavrat Bhartia',
            sanctionSearchTypes: ['SANCTIONS'],
            entityType: 'Person',
            gender: 'Male',
            aka: [],
            countries: ['India'],
            countryCodes: ['IN'],
            matchTypes: [],
            dateMatched: true,
            nationality: ['IN'],
            documents: [
              {
                id: 20603,
                name: 'Others',
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
            yearOfBirth: '1976',
            types: ['Relative or Close Associate (RCA)'],
          },
        ],
      ],
      '2024-02'
    )
    expect(repo.saveAssociations).toHaveBeenCalledWith(
      'dowjones',
      [['11756174', ['151775', '790369']]],
      '2024-02'
    )
  })
  it('should process split file archive', async () => {
    const filePath = path.resolve(__dirname, 'data/dowjones_splits')
    await fetcher.processSplitArchive(repo, '2024-02', filePath)
    fetcher = new DowJonesProvider('testuser', 'testpass')
    expect(repo.save).toHaveBeenCalledWith(
      'dowjones',
      [
        [
          'add',
          {
            id: '10183',
            name: 'Ange-Félix Patassé',
            entityType: 'Person',
            nationality: ['CF'],
            sanctionSearchTypes: ['PEP', 'SANCTIONS'],
            gender: 'Male',
            occupations: [
              {
                occupationCode: 'political_party_officials',
                rank: 'LEVEL_1',
                title: 'Deceased',
              },
            ],
            types: [
              'Politically Exposed Person (PEP)',
              'Special Interest Person (SIP) - Corruption',
            ],
            aka: [
              'Ange Félix Patassé',
              'Ange Felix Patasse',
              'Ange-Felix Patasse',
            ],
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
              },
              {
                id: 'M4800002143743',
                name: 'Others',
              },
              {
                id: 'CAR',
                name: 'OFAC Program ID',
              },
              {
                name: 'OFAC Unique ID',
              },
              {
                id: 'CAF',
                name: 'EU Sanctions Programme Indicator',
              },
              {
                id: 'CFi.001',
                name: 'UN Permanent Reference No.',
              },
              {
                id: 'CAF0003',
                name: 'UK Sanctions List Unique ID',
              },
              {
                id: 'The Central African Republic (Sanctions) (EU Exit) Regulations 2020',
                name: 'UK Sanctions List Regime',
              },
              {
                id: 'Central African Republic',
                name: 'HM Treasury Regime',
              },
            ],
            yearOfBirth: '1937',
            dateMatched: true,
            matchTypes: ['Corruption'],
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
            name: 'Martin Ziguélé',
            entityType: 'Person',
            gender: 'Male',
            documents: [],
            nationality: ['CF'],
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
            dateMatched: true,
            matchTypes: [],
            sanctionSearchTypes: ['PEP'],
            aka: ['Martin Zinguélé', 'Martin Ziguele', 'Martin Zinguele'],
            countries: ['Central African Republic'],
            countryCodes: ['CF'],
            yearOfBirth: '1957',
            types: ['Politically Exposed Person (PEP)'],
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
            '10228',
            '10261',
            '10374',
            '10441',
            '170224',
            '171089',
            '212451',
            '469057',
            '841803',
            '841805',
            '2922781',
            '4444238',
            '4444246',
            '4512176',
            '4512177',
            '4542634',
            '4542640',
            '12782575',
            '12782576',
            '12863222',
          ],
        ],
        [
          '10184',
          [
            '731784',
            '3414870',
            '3414873',
            '3414881',
            '3414884',
            '3414885',
            '3414886',
            '3414888',
            '3414889',
            '3414890',
            '3414893',
            '3414896',
            '3414900',
            '3414903',
            '3414905',
            '3414906',
            '3414907',
            '3414909',
            '3414910',
            '3414914',
            '3414915',
            '3414916',
            '3414919',
            '4478578',
          ],
        ],
      ],
      '2024-02'
    )
  })
})
