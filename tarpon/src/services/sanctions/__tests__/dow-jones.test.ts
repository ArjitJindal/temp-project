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
            sanctionSearchTypes: [], // RCAs are not sanctions
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
            yearOfBirth: '1976',
            types: ['Relative or Close Associate (RCA)'],
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
            sanctionSearchTypes: ['ADVERSE_MEDIA'], // only sanctions list mapped person in sanction
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
              },
              {
                id: 'CAF',
                name: 'EU Sanctions Programme Indicator',
                formattedId: 'CAF',
              },
              {
                id: 'CFi.001',
                name: 'UN Permanent Reference No.',
                formattedId: 'CFi.001',
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
            matchTypes: ['PEP'],
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
