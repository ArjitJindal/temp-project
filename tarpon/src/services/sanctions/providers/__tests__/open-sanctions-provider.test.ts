import { OpenSanctionsProvider } from '@/services/sanctions/providers/open-sanctions-provider'
import { MongoSanctionsRepository } from '@/services/sanctions/repositories/sanctions-repository'
import { DELTA_SANCTIONS_COLLECTION } from '@/utils/mongodb-definitions'
import { getTestTenantId } from '@/test-utils/tenant-test-utils'
import { OPEN_SANCTIONS_SEARCH_TYPES } from '@/@types/openapi-internal-custom/OpenSanctionsSearchType'

describe('OpenSanctionsProvider', () => {
  it('should filter URLs based on the given date', async () => {
    const tenantId = getTestTenantId()
    const openSanctionsProvider = new OpenSanctionsProvider(
      tenantId,
      OPEN_SANCTIONS_SEARCH_TYPES,
      ['PERSON']
    )
    // Mock input JSON
    const mockJson = {
      versions: {
        '20241209074701-ofz':
          'https://data.opensanctions.org/artifacts/sanctions/20241209074701-ofz/entities.delta.json',
        '20241208194702-bkq':
          'https://data.opensanctions.org/artifacts/sanctions/20241208194702-bkq/entities.delta.json',
        '20241206194702-hsg':
          'https://data.opensanctions.org/artifacts/sanctions/20241206194702-hsg/entities.delta.json',
      },
    }

    // Define the `from` date
    const fromDate = new Date('2024-12-08T19:00:00Z')

    // Call the function
    const result = openSanctionsProvider.filterUrls(mockJson, fromDate)

    // Expected output
    const expectedUrls = [
      'https://data.opensanctions.org/artifacts/sanctions/20241209074701-ofz/entities.delta.json',
      'https://data.opensanctions.org/artifacts/sanctions/20241208194702-bkq/entities.delta.json',
    ]

    // Assertion
    expect(result).toEqual(expectedUrls)
  })

  it('should transform a valid OpenSanctionsEntity correctly', () => {
    const mockEntity = {
      id: 'entity123',
      caption: 'John Doe',
      properties: {
        alias: ['John Doe', 'JD'],
        country: ['USA'],
        citizenship: ['us'],
        nationality: ['us'],
        notes: ['Note 1', 'Note 2'],
        gender: ['Male'],
        name: ['John Doe'],
        topics: ['crime', 'sanction'],
        sourceUrl: ['http://example.com'],
        birthDate: ['1980-05-12'],
      },
      schema: 'Person',
    }
    const openSanctionsProvider = new OpenSanctionsProvider(
      'test',
      OPEN_SANCTIONS_SEARCH_TYPES,
      ['PERSON']
    )

    const result = openSanctionsProvider.transformInput(mockEntity)

    expect(result).toEqual({
      id: 'entity123',
      aka: ['John Doe', 'Jd'],
      countries: ['United States of America'],
      countryCodes: ['US'],
      documents: [],
      entityType: 'PERSON',
      freetext: 'Note 1\nNote 2',
      gender: 'Male',
      matchTypes: [],
      name: 'John Doe',
      nationality: ['US'],
      sanctionSearchTypes: ['CRIME', 'SANCTIONS'],
      screeningSources: [
        { url: 'http://example.com', name: 'http://example.com' },
      ],
      types: ['CRIME', 'SANCTIONS'],
      yearOfBirth: '1980',
      updatedAt: expect.any(Number),
      isActivePep: undefined,
      isActiveSanctioned: undefined,
      isDeseased: false,
      occupations: [],
      dateOfBirths: ['1980-05-12'],
    })
  })

  it.skip('Full load', async () => {
    const tenantId = getTestTenantId()
    const openSanctionsProvider = new OpenSanctionsProvider(
      tenantId,
      OPEN_SANCTIONS_SEARCH_TYPES,
      ['PERSON']
    )
    const repo = new MongoSanctionsRepository(
      DELTA_SANCTIONS_COLLECTION(tenantId)
    )
    await openSanctionsProvider.fullLoad(repo, '2024-01-01')
  })
  it('Delta changes are loaded', async () => {
    const tenantId = getTestTenantId()
    const openSanctionsProvider = new OpenSanctionsProvider(
      tenantId,
      OPEN_SANCTIONS_SEARCH_TYPES,
      ['PERSON']
    )
    const repo = new MongoSanctionsRepository(
      DELTA_SANCTIONS_COLLECTION(tenantId)
    )
    // Get the current date
    const yesterday = new Date()
    yesterday.setDate(new Date().getDate() - 1)
    await openSanctionsProvider.delta(repo, '2024-01-01', yesterday)
  })
})
