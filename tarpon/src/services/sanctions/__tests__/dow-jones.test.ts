import axios from 'axios'
import AdmZip from 'adm-zip'
import { DowJonesDataFetcher } from '@/services/sanctions/providers/dow-jones'
import { SanctionsRepository } from '@/services/sanctions/providers/types'

jest.mock('axios')
jest.mock('adm-zip')

describe('DowJonesDataFetcher', () => {
  let fetcher: DowJonesDataFetcher
  let repo: SanctionsRepository

  beforeEach(async () => {
    fetcher = new DowJonesDataFetcher('testuser', 'testpass')
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

  it('should download and extract a ZIP file', async () => {
    const mockBuffer = Buffer.from('test zip data')
    ;(axios.get as jest.Mock).mockResolvedValue({ data: mockBuffer })
    const mockAdmZip = {
      extractAllTo: jest.fn(),
    }
    ;(AdmZip as jest.Mock).mockImplementation(() => mockAdmZip)

    const outputDir = await fetcher.downloadZip('testfile.zip')

    expect(axios.get).toHaveBeenCalledWith(
      'https://djrcfeed.dowjones.com/xml/testfile.zip',
      {
        headers: {
          Authorization: fetcher.authHeader,
          'Content-Type': 'application/zip',
        },
        responseType: 'arraybuffer',
      }
    )
    expect(mockAdmZip.extractAllTo).toHaveBeenCalledWith(
      '/tmp/unzipped_files/testfile',
      true
    )
    expect(outputDir).toBe('/tmp/unzipped_files/testfile')
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
            name: {
              firstName: 'John',
              surname: 'Smith',
            },
            entityType: 'Person',
            aka: [
              {
                firstName: 'John',
                surname: 'Smyth',
              },
            ],
          },
        ],
        [
          'update',
          {
            id: '12300003',
            name: {
              firstName: 'John',
              surname: 'Smitten',
            },
            entityType: 'Person',
            aka: [],
          },
        ],
      ],
      '2024-02'
    )
  })
})
