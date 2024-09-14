import axios from 'axios'
import { DowJonesProvider } from '@/services/sanctions/providers/dow-jones-provider'
import { SanctionsRepository } from '@/services/sanctions/providers/types'

jest.mock('axios')
jest.mock('unzipper')
jest.mock('fs-extra')

const XmlRecord = `
<Person id="795164" action="add" date="17-Mar-2023">
  <Gender>Male</Gender>
  <ActiveStatus>Inactive</ActiveStatus>
  <Deceased>Yes</Deceased>
  <NameDetails>
    <Name NameType="Primary Name">
      <NameValue>
        <FirstName>Somphol</FirstName>
        <Surname>Keyuraphun</Surname>
        <OriginalScriptName>สมพล เกยุราพันธุ์</OriginalScriptName>
      </NameValue>
    </Name>
    <Name NameType="Spelling Variation">
      <NameValue>
        <FirstName>Somphol</FirstName>
        <Surname>Keyuraphan</Surname>
      </NameValue>
      <NameValue>
        <FirstName>Somphon</FirstName>
        <Surname>Keyulaphan</Surname>
      </NameValue>
      <NameValue>
        <FirstName>Sompon</FirstName>
        <Surname>Keyurapan</Surname>
      </NameValue>
    </Name>
  </NameDetails>
  <Descriptions>
    <Description Description1="1" />
  </Descriptions>
  <RoleDetail>
    <Roles RoleType="Primary Occupation">
      <OccTitle OccCat="3">Deceased</OccTitle>
    </Roles>
    <Roles RoleType="Previous Roles">
      <OccTitle SinceDay="26" SinceMonth="Jan" SinceYear="2008" ToDay="09" ToMonth="May" ToYear="2011" OccCat="3">Member, House of Representatives, Pheu Thai Party (PT), Party List</OccTitle>
      <OccTitle SinceDay="03" SinceMonth="Jul" SinceYear="2011" ToDay="09" ToMonth="Dec" ToYear="2013" OccCat="3">Member, House of Representatives, Pheu Thai Party (PT), Party List</OccTitle>
    </Roles>
  </RoleDetail>
  <DateDetails>
    <Date DateType="Date of Birth">
      <DateValue Day="21" Month="Oct" Year="1937" />
    </Date>
    <Date DateType="Deceased Date">
      <DateValue Day="28" Month="Nov" Year="2014" />
    </Date>
    <Date DateType="Inactive as of (PEP)">
      <DateValue Day="09" Month="Dec" Year="2013" />
    </Date>
  </DateDetails>
  <CountryDetails>
    <Country CountryType="Citizenship">
      <CountryValue Code="THAIL" />
    </Country>
    <Country CountryType="Resident of">
      <CountryValue Code="THAIL" />
    </Country>
    <Country CountryType="Jurisdiction">
      <CountryValue Code="THAIL" />
    </Country>
  </CountryDetails>
  <IDNumberTypes>
    <ID IDType="National ID">
      <IDValue>3 1005 02209 70 8</IDValue>
    </ID>
  </IDNumberTypes>
  <Images>
    <Image URL="https://hilight.kapook.com/img_cms2/user/settawoot/z-2_128.jpg" />
  </Images>
</Person>
`

describe('DowJonesProvider', () => {
  let fetcher: DowJonesProvider
  let repo: SanctionsRepository

  beforeEach(async () => {
    fetcher = new DowJonesProvider('testuser', 'testpass')
    repo = {
      save: jest.fn(),
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

  it('should parse XML and save entities to the repository', async () => {
    const mockXml = `
      <PFA>
        <Person id="12300002" action="add">
          <NameDetails>
            <Name NameType="Primary Name">
              <NameValue>
                <FirstName>John</FirstName>
                <Surname>Smith</Surname>
              </NameValue>
            </Name>
            <Name NameType="Spelling Variation">
              <NameValue>
                <FirstName>John</FirstName>
                <Surname>Smyth</Surname>
              </NameValue>
            </Name>
          </NameDetails>
        </Person>
        <Person id="12300003" action="update">
          <NameDetails>
            <Name NameType="Primary Name">
              <NameValue>
                <FirstName>John</FirstName>
                <Surname>Smitten</Surname>
              </NameValue>
            </Name>
          </NameDetails>
        </Person>
      </PFA>`

    await fetcher.fileToEntities(repo, '2024-02', mockXml)

    expect(repo.save).toHaveBeenCalledWith(
      'dowjones',
      [
        [
          'add',
          {
            id: '12300002',
            name: 'John Smith',
            entityType: 'Person',
            aka: ['John Smyth'],
          },
        ],
        [
          'update',
          {
            id: '12300003',
            name: 'John Smitten',
            entityType: 'Person',
            aka: [],
          },
        ],
      ],
      '2024-02'
    )
  })

  it('should parse complex XML and save entity', async () => {
    const mockXml = `<PFA>${XmlRecord}</PFA>`

    await fetcher.fileToEntities(repo, '2024-02', mockXml)

    expect(repo.save).toHaveBeenCalledWith(
      'dowjones',
      [
        [
          'add',
          {
            id: '795164',
            name: 'Somphol Keyuraphun',
            entityType: 'Person',
            aka: [
              'Somphol Keyuraphan',
              'Somphon Keyulaphan',
              'Sompon Keyurapan',
            ],
            countries: ['THAIL'],
            yearOfBirth: '1937',
          },
        ],
      ],
      '2024-02'
    )
  })
})
