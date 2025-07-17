import path from 'path'
import axios from 'axios'
import { DowJonesProvider } from '@/services/sanctions/providers/dow-jones-provider'
import { SanctionsRepository } from '@/services/sanctions/providers/types'
import { SanctionsEntity } from '@/@types/openapi-internal/SanctionsEntity'
import { DOW_JONES_SANCTIONS_SEARCH_TYPES } from '@/@types/openapi-internal-custom/DowJonesSanctionsSearchType'
import { SANCTIONS_ENTITY_TYPES } from '@/@types/openapi-internal-custom/SanctionsEntityType'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { dynamoDbSetupHook } from '@/test-utils/dynamodb-test-utils'

jest.mock('axios')
jest.mock('unzipper')
jest.mock('fs-extra')

dynamoDbSetupHook()

describe('DowJonesProvider', () => {
  let fetcher: DowJonesProvider
  let repo: SanctionsRepository

  beforeEach(async () => {
    fetcher = new DowJonesProvider(
      'testuser',
      'testpass',
      'test',
      DOW_JONES_SANCTIONS_SEARCH_TYPES,
      SANCTIONS_ENTITY_TYPES,
      {
        mongoDb: await getMongoDbClient(),
        dynamoDb: getDynamoDbClient(),
      }
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
      ['PERSON'],
      {
        mongoDb: await getMongoDbClient(),
        dynamoDb: getDynamoDbClient(),
      }
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
            normalizedAka: ['priyavrat bhartia'],
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
        [
          'chg',
          {
            id: '754486',
            name: 'ses international corp',
            entityType: 'BUSINESS',
            aka: [
              'ses automobile',
              'ses group',
              'ses international corporation',
            ],
            countries: ['Syrian Arab Republic'],
            countryCodes: ['SY'],
            documents: [
              {
                formattedId: 'IRAQ2',
                id: 'IRAQ2',
                name: 'OFAC Program ID',
              },
              {
                formattedId: '8882',
                id: '8882',
                name: 'OFAC Unique ID',
              },
              {
                formattedId: 'SYRIA',
                id: 'SYRIA',
                name: 'Related OFAC Program ID',
              },
              {
                formattedId: '8868',
                id: '8868',
                name: 'Related OFAC Unique ID',
              },
              {
                formattedId: '8881',
                id: '8881',
                name: 'Related OFAC Unique ID',
              },
              {
                formattedId: 'SYR',
                id: 'SYR',
                name: 'Related EU Sanctions Programme Indicator',
              },
              {
                formattedId: '6476',
                id: '6476',
                name: 'Related EU Consolidated Electronic List ID',
              },
              {
                formattedId: '12013',
                id: '12013',
                name: 'Related HM Treasury Group ID',
              },
              {
                formattedId: '15860',
                id: '15860',
                name: 'Related HM Treasury Group ID',
              },
              {
                formattedId: 'Syria',
                id: 'Syria',
                name: 'Related HM Treasury Regime',
              },
              {
                formattedId: '2266',
                id: '2266',
                name: 'Related DFAT Reference Number',
              },
            ],
            freetext: `DOW JONES NOTES:

05-Jan-2016
SES International Corp is owned by OFAC SDN and EU sanctioned Zuhayr Shalish.

PROFILE UPDATED: 26-Feb-2016
SES International Corp is owned by OFAC SDN and EU Sanctioned Zuhayr Shalish and is managed by OFAC SDN Asif Shalish.

PROFILE UPDATED: 17-May-2021
This company is to an unknown stake owned by OFAC SDN and EU and UK Sanctioned Zuhayr Shalish. OFAC SDN and UK Sanctioned Asif Shalish is Manager of this company.

PROFILE UPDATED: 13-Jul-2024
As of 13-Jul-2024 the Sanctions Control & Ownership (SCO) content has been expanded to include additional jurisdictions. As a result, this profile's SCO descriptions have been updated accordingly.

PROFILE UPDATED: 07-Sep-2024
This company is to an unknown stake owned by OFAC SDN and UK and Canada and Japan Sanctioned Zuhayr Shalish. OFAC SDN and UK Sanctioned Asif Shalish is Manager of this company.`,
            isActiveSanctioned: true,
            matchTypes: [
              'Sanctions Lists',
              'Sanctions Control and Ownership',
              'Sanctions Control and Ownership',
              'Sanctions Control and Ownership',
              'Sanctions Control and Ownership',
              'Sanctions Control and Ownership',
              'Sanctions Control and Ownership',
              'Sanctions Control and Ownership',
            ],
            nationality: ['SY'],
            normalizedAka: [
              'ses automobile',
              'ses group',
              'ses international corporation',
              'ses international corp',
            ],
            sanctionSearchTypes: ['SANCTIONS'],
            screeningSources: [
              {
                name: 'https://www.treasury.gov/press-center/press-releases/Pages/js2487.aspx',
              },
              {
                name: 'http://www.treas.gov/offices/enforcement/ofac/sdn/sdnlist.txt',
              },
              {
                name: 'http://www.treas.gov/offices/enforcement/ofac/sdn/t11sdn.pdf',
              },
              {
                name: 'http://madardaily.com/2015/07/22/%D9%87%D9%84-%D9%8A%D8%B3%D9%84%D9%83-%D8%B0%D9%88-%D8%A7%D9%84%D9%87%D9%85%D8%A9-%D8%B4%D8%A7%D9%84%D9%8A%D8%B4-%D8%B7%D8%B1%D9%8A%D9%82%D8%A7%D9%8B-%D8%A5%D9%84%D9%89-%D9%85%D8%B4%D9%81%D9%89-%D8%A7/',
              },
              {
                name: 'http://www.souriyati.com/2015/09/04/20180.html',
              },
              {
                name: 'https://web.archive.org/web/20150725043828/http://madardaily.com:80/2015/07/22/هل-يسلك-ذو-الهمة-شاليش-طريقاً-إلى-مشفى-ا/',
              },
              {
                name: 'https://web.archive.org/web/20191127074950/http://www.souriyati.com:80/2015/09/04/20180.html',
              },
              {
                name: 'https://stepagency-sy.net/2022/05/15/%D8%B0%D9%88-%D8%A7%D9%84%D9%87%D9%85%D8%A9-%D8%B4%D8%A7%D9%84%D9%8A%D8%B4/',
              },
            ],
            types: [
              'Special Interest Entity (SIE) - Sanctions Lists',
              'Special Interest Entity (SIE) - Sanctions Control and Ownership - OFAC Related - Ownership Unknown',
              'Special Interest Entity (SIE) - Sanctions Control and Ownership - Formerly EU Related',
              'Special Interest Entity (SIE) - Sanctions Control and Ownership - OFAC Related - Control',
              'Special Interest Entity (SIE) - Sanctions Control and Ownership - UK Related - Ownership Unknown',
              'Special Interest Entity (SIE) - Sanctions Control and Ownership - UK Related - Control',
              'Special Interest Entity (SIE) - Sanctions Control and Ownership - Canada Related - Ownership Unknown',
              'Special Interest Entity (SIE) - Sanctions Control and Ownership - Japan Related - Ownership Unknown',
            ],
          },
        ],
        [
          'chg',
          {
            id: '4532467',
            name: 'kamoki energy limited',
            entityType: 'BUSINESS',
            aka: ['kamoke energy limited'],
            countries: ['Pakistan'],
            countryCodes: ['PK'],
            documents: [
              {
                formattedId: '69697',
                id: '69697',
                name: 'Company Identification No.',
              },
              {
                formattedId: '983843655',
                id: '983843655',
                name: 'DUNS Number',
              },
              {
                formattedId: 'LIBYA2',
                id: 'LIBYA2',
                name: 'Related OFAC Program ID',
              },
              {
                formattedId: 'EO13566',
                id: 'EO13566',
                name: 'Related OFAC Program ID',
              },
              {
                formattedId: '12636',
                id: '12636',
                name: 'Related OFAC Unique ID',
              },
              {
                formattedId: '12639',
                id: '12639',
                name: 'Related OFAC Unique ID',
              },
              {
                formattedId: 'LBY',
                id: 'LBY',
                name: 'Related EU Sanctions Programme Indicator',
              },
              {
                formattedId: '6124',
                id: '6124',
                name: 'Related EU Consolidated Electronic List ID',
              },
              {
                formattedId: '11666',
                id: '11666',
                name: 'Related HM Treasury Group ID',
              },
              {
                formattedId: 'Libya',
                id: 'Libya',
                name: 'Related HM Treasury Regime',
              },
              {
                formattedId: '1250',
                id: '1250',
                name: 'Related DFAT Reference Number',
              },
              {
                formattedId: 'LYe.001',
                id: 'LYe.001',
                name: 'Related UN Permanent Reference No.',
              },
              {
                formattedId: 'Consolidated List',
                id: 'Consolidated List',
                name: 'Related Australian Regulation',
              },
            ],
            freetext: `DOW JONES NOTES:

23-Mar-2016
This company is 50% owned by Pak-Libya Holding Company.

PROFILE UPDATED: 01-Jun-2016
This company is 50% owned by Pak-Libya Holding Company, which in turn is 50% owned by OFAC E.O. 13566 sanctioned Libyan Foreign Investment Company, a fully owned subsidiary of OFAC E.O. 13566 and EU sanctioned Libyan Investment Authority.

PROFILE UPDATED: 09-Mar-2021
This company is 50% owned by Pak-Libya Holding Company. Pak-Libya Holding Company is majority owned by OFAC E.O. 13566 Libyan Foreign Investment Company, and is indirectly majority owned by OFAC E.O. 13566 and EU and UK Sanctioned Libyan Investment Authority.

PROFILE UPDATED: 13-Jul-2024
As of 13-Jul-2024 the Sanctions Control & Ownership (SCO) content has been expanded to include additional jurisdictions. As a result, this profile's SCO descriptions have been updated accordingly.

PROFILE UPDATED: 19-Aug-2024
This company is 50% owned by Pak-Libya Holding Company. Pak-Libya Holding Company is majority owned by OFAC E.O. 13566 Sanctioned Libyan Foreign Investment Company, and is indirectly majority owned by OFAC E.O. 13566 and EU and UK and UN and Japan and Australia Sanctioned Libyan Investment Authority.


OFFICE OF FOREIGN ASSETS CONTROL (OFAC) NOTES:

Issuance of Libya General License No. 11 Unblocking the Government of Libya and the Central Bank of Libya, With Certain Exceptions
12/16/2011
On December 16, 2011, OFAC issued General License No. 11 pursuant to the Libyan Sanctions Regulations, 31 CFR Part 570, and Executive Order 13566 of February 25, 2011, "Blocking Property and Prohibiting Certain Transactions Related to Libya." General License No. 11 unblocks all property and interests in property of the Government of Libya, its agencies, instrumentalities, and controlled entities, and the Central Bank of Libya (including Libyan Arab Foreign Bank), except that all funds, including cash, securities, bank accounts, and investment accounts, and precious metals of the Libyan Investment Authority (“LIA”) and entities owned or controlled by the LIA (including the Libyan Africa Investment Portfolio) blocked as of September 19, 2011, remain blocked.

11/18/2011 
General License No. 8A authorizes prospective transactions involving the Government of Libya, its agencies, instrumentalities, and controlled entities, and the Central Bank of Libya, as of September 19, 2011. Funds, including cash, securities, bank accounts, and investment accounts, and precious metals that were blocked pursuant to E.O. 13566 as of September 19, 2011, continue to remain blocked, except as otherwise authorized by OFAC.


EU NOTES REGARDING LIBYAN INVESTMENT AUTHORITY (LIA):

Other Information: Listed pursuant to paragraph 17 of resolution 1973, as modified on 16 September pursuant to paragraph 15 of resolution 2009. 
Remark: Note: This entity [LIA] is targeted by a limited asset freeze concerning assets belonging to, or owned, held or controlled on 16 September 2011 by it and located outside Libya on that date. There is no prohibition to make funds or economic resources available to this entity [LIA], whether directly or indirectly.
Phone: 218 21 336 2091
Fax: 218 21 336 2082


HM TREASURY - OFFICE OF FINANCIAL SANCTIONS IMPLEMENTATION
Financial sanctions guidance for the Libya (Sanctions) (EU Exit) Regulations 2020

OFSI guidance on the Regulations
This guidance aims to help stakeholders navigate the Regulations that specifically apply to the Libya financial sanctions regime. As well as a full asset freeze, the Regulations impose other prohibitions and requirements including a partial asset freeze (only the Libyan Investment Authority (LIA) and the Libya Africa Investment Portfolio (LAIP) have been designated in respect of this), and prohibitions on financial transactions in relation to Libyan oil aboard UN-designated ships. 

Subsidiaries of the Libyan Investment Authority (LIA) and the Libya Africa Investment Portfolio (LAIP)
Both the LIA and the LAIP are subject to the partial asset freeze. Subsidiaries of the LIA and LAIP are not automatically subject to the partial asset freeze simply by virtue of being subsidiaries of these companies. However, it should be noted that some subsidiaries of the LIA and LAIP are designated independently by the UK under the full asset freeze, set out in the Regulations. Therefore, it is advised that you consult the OFSI consolidated list, and that you conduct your own due diligence to understand whether any such subsidiary is subject to financial prohibitions.`,
            isActiveSanctioned: false,
            matchTypes: [
              'Sanctions Control and Ownership',
              'Sanctions Control and Ownership',
              'Sanctions Control and Ownership',
              'Sanctions Control and Ownership',
              'Sanctions Control and Ownership',
              'Sanctions Control and Ownership',
            ],
            nationality: ['PK'],
            normalizedAka: ['kamoke energy limited', 'kamoki energy limited'],
            sanctionSearchTypes: ['SANCTIONS'],
            screeningSources: [
              {
                name: 'https://www.paklibya.com.pk/_assets/financials-files/F%20S%20Sept%20%202015.pdf',
              },
              {
                name: 'http://www.directoryforest.com/kamoki-energy-limited-kamoke/',
              },
              {
                name: 'http://www.secp.gov.pk/ns/company.asp?COMPANY_CODE=0069697&id=',
              },
              {
                name: 'https://paklibya.com.pk/uploads/files/financials-files/FS_31_December_2016.pdf',
              },
              {
                name: 'http://info-pk.com/kamoki_energy_limited/37884/',
              },
              {
                name: 'https://paklibya.com.pk/uploads/files/financials-files/FS_30_Sept_2018.pdf',
              },
              {
                name: 'https://paklibya.com.pk/uploads/files/financials-files/PLHC-AR-2017.pdf',
              },
              {
                name: 'http://www.pacra.com.pk/uploads/summary_report/20170623124817_120Pak%20libya_rating%20report_fy17.pdf',
              },
              {
                name: 'https://paklibya.com.pk/uploads/files/financials-files/FS_30_Sept_2019.pdf',
              },
              {
                name: 'https://paklibya.com.pk/uploads/files/financials-files/F.S-Dec-31-2021.pdf',
              },
              {
                name: 'https://assets.publishing.service.gov.uk/media/65cb9dce39a8a7000c60d4d8/Libya_guidance_September_2022.pdf',
              },
              {
                name: 'https://assets.publishing.service.gov.uk/media/656896d4cc1ec500138eefbf/Libya.pdf',
              },
              {
                name: 'https://ofac.treasury.gov/recent-actions/20111118',
              },
              {
                name: 'https://ofac.treasury.gov/recent-actions/20111216',
              },
            ],
            types: [
              'Special Interest Entity (SIE) - Sanctions Control and Ownership - OFAC Related - Majority Owned',
              'Special Interest Entity (SIE) - Sanctions Control and Ownership - EU Related - Majority Owned',
              'Special Interest Entity (SIE) - Sanctions Control and Ownership - UK Related - Majority Owned',
              'Special Interest Entity (SIE) - Sanctions Control and Ownership - Australia Related - Majority Owned',
              'Special Interest Entity (SIE) - Sanctions Control and Ownership - Japan Related - Majority Owned',
              'Special Interest Entity (SIE) - Sanctions Control and Ownership - UN Related - Majority Owned',
            ],
            yearOfBirth: ['2009'],
          },
        ],
        [
          'chg',
          {
            id: '12692439',
            name: 'first national insurance (life) holding company limited',
            entityType: 'BUSINESS',
            aka: [],
            countries: ['Myanmar'],
            countryCodes: ['MM'],
            documents: [
              {
                formattedId: '120789988',
                id: '120789988',
                name: 'Company Identification No.',
              },
              {
                formattedId: 'BURMAEO14014',
                id: 'BURMA-EO14014',
                name: 'Related OFAC Program ID',
              },
              {
                formattedId: '34666',
                id: '34666',
                name: 'Related OFAC Unique ID',
              },
              {
                formattedId: '34667',
                id: '34667',
                name: 'Related OFAC Unique ID',
              },
              {
                formattedId: '16188',
                id: '16188',
                name: 'Related HM Treasury Group ID',
              },
              {
                formattedId: '16189',
                id: '16189',
                name: 'Related HM Treasury Group ID',
              },
              {
                formattedId: 'Myanmar',
                id: 'Myanmar',
                name: 'Related HM Treasury Regime',
              },
              {
                formattedId: 'Burma',
                id: 'Burma',
                name: 'Related Canadian Regulation',
              },
            ],
            freetext: `DOW JONES NOTES:

08-Feb-2022
This company is 82.83% owned by OFAC SDN Htoo Htet Tay Za and 16.85% owned by OFAC SDN Pye Phyo Tay Za.
Both OFAC SDN Htoo Htet Tay Za and OFAC SDN Pye Phyo Tay Za are Members of Board of Directors of this company.

PROFILE UPDATED: 07-Nov-2023
This company is 82.83% owned by OFAC SDN and UK Sanctioned Htoo Htet Tay Za, and 16.85% owned by OFAC SDN and UK Sanctioned Pye Phyo Tay Za. OFAC SDN and UK Sanctioned Htoo Htet Tay Za is Member, Board of Directors of this company. OFAC SDN and UK Sanctioned Pye Phyo Tay Za is Member, Board of Directors of this company.

PROFILE UPDATED: 14-Jul-2024
As of 13-Jul-2024 the Sanctions Control & Ownership (SCO) content has been expanded to include additional jurisdictions. As a result, this profile's SCO descriptions have been updated accordingly.

PROFILE UPDATED: 07-Sep-2024
This company is 82.83% owned by OFAC SDN and UK and Canada Sanctioned Htoo Htet Tay Za, and 16.85% owned by OFAC SDN and UK and Canada Sanctioned Pye Phyo Tay Za. OFAC SDN and UK and Canada Sanctioned Htoo Htet Tay Za is Member, Board of Directors of this company. OFAC SDN and UK and Canada Sanctioned Pye Phyo Tay Za is Member, Board of Directors of this company.`,
            isActiveSanctioned: false,
            matchTypes: [
              'Sanctions Control and Ownership',
              'Sanctions Control and Ownership',
              'Sanctions Control and Ownership',
              'Sanctions Control and Ownership',
              'Sanctions Control and Ownership',
              'Sanctions Control and Ownership',
            ],
            nationality: ['MM'],
            normalizedAka: [
              'first national insurance (life) holding company limited',
            ],
            sanctionSearchTypes: ['SANCTIONS'],
            screeningSources: [
              {
                name: 'http://web.archive.org/web/20170926205201/http://fnipublic.com/',
              },
              {
                name: 'https://jfm-files.s3.us-east-2.amazonaws.com/public/HTOO+Subsidries+Extracts/FIRST+NATIONAL+INSURANCE+(LIFE)+HOLDING+COMPANY+LIMITED.pdf',
              },
              {
                name: 'https://myco.dica.gov.mm/Corp/EntityProfile.aspx?id=239e2ec7-7992-4ab0-8331-1b9c244db8a7',
              },
              {
                name: 'https://www.fnilife.com/contact/',
              },
            ],
            types: [
              'Special Interest Entity (SIE) - Sanctions Control and Ownership - OFAC Related - Majority Owned',
              'Special Interest Entity (SIE) - Sanctions Control and Ownership - OFAC Related - Control',
              'Special Interest Entity (SIE) - Sanctions Control and Ownership - UK Related - Majority Owned',
              'Special Interest Entity (SIE) - Sanctions Control and Ownership - UK Related - Control',
              'Special Interest Entity (SIE) - Sanctions Control and Ownership - Canada Related - Majority Owned',
              'Special Interest Entity (SIE) - Sanctions Control and Ownership - Canada Related - Control',
            ],
            yearOfBirth: ['2019'],
          },
        ],
        [
          'chg',
          {
            id: '12692486',
            name: 'first national insurance (life) company limited',
            entityType: 'BUSINESS',
            aka: [],
            countries: ['Myanmar'],
            countryCodes: ['MM'],
            documents: [
              {
                formattedId: '116217651',
                id: '116217651',
                name: 'Company Identification No.',
              },
              {
                formattedId: 'BURMAEO14014',
                id: 'BURMA-EO14014',
                name: 'Related OFAC Program ID',
              },
              {
                formattedId: '34666',
                id: '34666',
                name: 'Related OFAC Unique ID',
              },
              {
                formattedId: '34667',
                id: '34667',
                name: 'Related OFAC Unique ID',
              },
              {
                formattedId: '16188',
                id: '16188',
                name: 'Related HM Treasury Group ID',
              },
              {
                formattedId: '16189',
                id: '16189',
                name: 'Related HM Treasury Group ID',
              },
              {
                formattedId: 'Myanmar',
                id: 'Myanmar',
                name: 'Related HM Treasury Regime',
              },
              {
                formattedId: 'Burma',
                id: 'Burma',
                name: 'Related Canadian Regulation',
              },
            ],
            freetext: `DOW JONES NOTES:

08-Feb-2022
This company is 100% owned by First National Insurance (Life) Holding Company Limited, which is 82.83% owned by OFAC SDN Htoo Htet Tay Za and 16.85% owned by OFAC SDN Pye Phyo Tay Za.
OFAC SDN Htoo Htet Tay Za and OFAC SDN Pye Phyo Tay Za are Members of Board of Directors in this company.

PROFILE UPDATED: 07-Nov-2023
This company is 100% owned by First National Insurance (Life) Holding Company Limited. OFAC SDN and UK Sanctioned Htoo Htet Tay Za is Member, Board of Directors of this company. OFAC SDN and UK Sanctioned Pye Phyo Tay Za is Member, Board of Directors of this company. First National Insurance (Life) Holding Company Limited is majority owned by OFAC SDN and UK Sanctioned Htoo Htet Tay Za, and is minority owned by OFAC SDN and UK Sanctioned Pye Phyo Tay Za.

PROFILE UPDATED: 13-Jul-2024
As of 13-Jul-2024 the Sanctions Control & Ownership (SCO) content has been expanded to include additional jurisdictions. As a result, this profile's SCO descriptions have been updated accordingly.

PROFILE UPDATED: 07-Sep-2024
This company is 100% owned by First National Insurance (Life) Holding Company Limited. OFAC SDN and UK and Canada Sanctioned Htoo Htet Tay Za is Member, Board of Directors of this company. OFAC SDN and UK and Canada Sanctioned Pye Phyo Tay Za is Member, Board of Directors of this company. First National Insurance (Life) Holding Company Limited is majority owned by OFAC SDN and UK and Canada Sanctioned Htoo Htet Tay Za, and is minority owned by OFAC SDN and UK and Canada Sanctioned Pye Phyo Tay Za.`,
            isActiveSanctioned: false,
            matchTypes: [
              'Sanctions Control and Ownership',
              'Sanctions Control and Ownership',
              'Sanctions Control and Ownership',
              'Sanctions Control and Ownership',
              'Sanctions Control and Ownership',
              'Sanctions Control and Ownership',
            ],
            nationality: ['MM'],
            normalizedAka: ['first national insurance (life) company limited'],
            sanctionSearchTypes: ['SANCTIONS'],
            screeningSources: [
              {
                name: 'https://jfm-files.s3.us-east-2.amazonaws.com/public/HTOO+Subsidries+Extracts/FIRST+NATIONAL+INSURANCE(LIFE)COMPANY+LIMITED.pdf',
              },
              {
                name: 'https://myco.dica.gov.mm/Corp/EntityProfile.aspx?id=a6546ec7-06eb-4e6d-99e0-51c0bebbca38',
              },
              {
                name: 'https://www.fnilife.com/our-company/',
              },
            ],
            types: [
              'Special Interest Entity (SIE) - Sanctions Control and Ownership - OFAC Related - Majority Owned',
              'Special Interest Entity (SIE) - Sanctions Control and Ownership - OFAC Related - Control',
              'Special Interest Entity (SIE) - Sanctions Control and Ownership - UK Related - Majority Owned',
              'Special Interest Entity (SIE) - Sanctions Control and Ownership - UK Related - Control',
              'Special Interest Entity (SIE) - Sanctions Control and Ownership - Canada Related - Majority Owned',
              'Special Interest Entity (SIE) - Sanctions Control and Ownership - Canada Related - Control',
            ],
            yearOfBirth: ['2019'],
          },
        ],
        [
          'chg',
          {
            id: '13013559',
            name: 'shoon holdings company limited',
            entityType: 'BUSINESS',
            aka: [],
            countries: ['Myanmar'],
            countryCodes: ['MM'],
            documents: [
              {
                formattedId: '135269034',
                id: '135269034',
                name: 'Company Identification No.',
              },
              {
                formattedId: 'BURMAEO14014',
                id: 'BURMA-EO14014',
                name: 'Related OFAC Program ID',
              },
              {
                formattedId: '44658',
                id: '44658',
                name: 'Related OFAC Unique ID',
              },
              {
                formattedId: '15858',
                id: '15858',
                name: 'Related HM Treasury Group ID',
              },
              {
                formattedId: 'Myanmar',
                id: 'Myanmar',
                name: 'Related HM Treasury Regime',
              },
              {
                formattedId: 'Burma',
                id: 'Burma',
                name: 'Related Canadian Regulation',
              },
            ],
            freetext: `DOW JONES NOTES:

03-Apr-2023
UK Sanctioned Khin Phyu Win is Director of this company.

PROFILE UPDATED: 25-Aug-2023
OFAC SDN and UK Sanctioned Khin Phyu Win is Director of this company.

PROFILE UPDATED: 14-Jul-2024
As of 13-Jul-2024 the Sanctions Control & Ownership (SCO) content has been expanded to include additional jurisdictions. As a result, this profile's SCO descriptions have been updated accordingly.

PROFILE UPDATED: 07-Sep-2024
OFAC SDN and UK and Canada Sanctioned Khin Phyu Win is Director of this company.`,
            isActiveSanctioned: false,
            matchTypes: [
              'Sanctions Control and Ownership',
              'Sanctions Control and Ownership',
              'Sanctions Control and Ownership',
            ],
            nationality: ['MM'],
            normalizedAka: ['shoon holdings company limited'],
            sanctionSearchTypes: ['SANCTIONS'],
            screeningSources: [
              {
                name: 'https://www.irrawaddy.com/news/burma/businesswoman-sanctioned-for-supplying-junta-tied-to-at-least-10-more-firms-in-myanmar.html',
              },
              {
                name: 'https://myco.dica.gov.mm/Corp/EntityProfile.aspx?id=8b8290b4-796b-418d-b5fc-e013ba263f43',
              },
            ],
            types: [
              'Special Interest Entity (SIE) - Sanctions Control and Ownership - OFAC Related - Control',
              'Special Interest Entity (SIE) - Sanctions Control and Ownership - UK Related - Control',
              'Special Interest Entity (SIE) - Sanctions Control and Ownership - Canada Related - Control',
            ],
            yearOfBirth: ['2022'],
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
      SANCTIONS_ENTITY_TYPES,
      {
        mongoDb: await getMongoDbClient(),
        dynamoDb: getDynamoDbClient(),
      }
    )
    expect(repo.save).toHaveBeenCalledWith(
      'dowjones',
      [
        [
          'add',
          {
            id: '10183',
            name: 'ange-félix patassé',
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
              'ange-felix patasse',
            ],
            normalizedAka: ['ange felix patasse', 'ange-felix patasse'],
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
            name: 'martin ziguélé',
            entityType: 'PERSON',
            gender: 'Male',
            documents: [],
            nationality: ['CF'],
            normalizedAka: ['martin zinguele', 'martin ziguele'],
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
            aka: ['martin zinguélé', 'martin ziguele', 'martin zinguele'],
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
          key: 'yearOfBirth',
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
          key: 'yearOfBirth',
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
