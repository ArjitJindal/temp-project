import axios from 'axios'
import { DowJonesDataFetcher } from '@/services/sanctions/providers/dow-jones'
import { SanctionsRepository } from '@/services/sanctions/providers/types'

jest.mock('axios')
jest.mock('unzipper')
jest.mock('fs-extra')

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
