import {
  OpenSanctionsProvider,
  transformInput,
} from '@/services/sanctions/providers/open-sanctions-provider'
import { MongoSanctionsRepository } from '@/services/sanctions/repositories/sanctions-repository'
import { DELTA_SANCTIONS_COLLECTION } from '@/utils/mongodb-definitions'
import { getTestTenantId } from '@/test-utils/tenant-test-utils'

describe('OpenSanctionsProvider', () => {
  it('should filter URLs based on the given date', async () => {
    const tenantId = getTestTenantId()
    const openSanctionsProvider = new OpenSanctionsProvider(tenantId)
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
      schema: 'person',
    }

    const result = transformInput(mockEntity)

    expect(result).toEqual({
      id: 'entity123',
      aka: ['John Doe', 'JD'],
      countries: ['USA'],
      countryCodes: ['US'],
      documents: [],
      entityType: 'person',
      freetext: 'Note 1\nNote 2',
      gender: 'Male',
      matchTypes: [],
      name: 'John Doe',
      nationality: ['US'],
      sanctionSearchTypes: ['SANCTIONS'],
      screeningSources: [{ url: 'http://example.com' }],
      types: [],
      yearOfBirth: '1980',
      updatedAt: expect.any(Number),
    })
  })

  it('should handle missing optional fields gracefully', () => {
    const mockEntity = {
      id: 'entity456',
      properties: {},
      schema: 'company',
    }

    const result = transformInput(mockEntity)

    expect(result).toEqual({
      id: 'entity456',
      aka: [],
      countries: [],
      countryCodes: ['ZZ'],
      documents: [],
      entityType: 'company',
      freetext: '',
      gender: 'Unknown',
      matchTypes: [],
      name: 'Unknown',
      nationality: ['ZZ'],
      sanctionSearchTypes: [],
      screeningSources: undefined,
      types: [],
      yearOfBirth: 'Unknown',
      updatedAt: expect.any(Number),
    })
  })

  it('should throw an error for unknown topics', () => {
    expect(() =>
      transformInput({
        id: 'entity789',
        properties: {
          topics: ['unknown.topic'],
        },
        schema: 'person',
      })
    ).toThrowError('Unknown topic unknown.topic')
  })

  it.skip('Full load', async () => {
    const tenantId = getTestTenantId()
    const openSanctionsProvider = new OpenSanctionsProvider(tenantId)
    const repo = new MongoSanctionsRepository(
      DELTA_SANCTIONS_COLLECTION(tenantId)
    )
    await openSanctionsProvider.fullLoad(repo, '2024-01-01')
  })
  it('Delta changes are loaded', async () => {
    const tenantId = getTestTenantId()
    const openSanctionsProvider = new OpenSanctionsProvider(tenantId)
    const repo = new MongoSanctionsRepository(
      DELTA_SANCTIONS_COLLECTION(tenantId)
    )
    // Get the current date
    const yesterday = new Date()
    yesterday.setDate(new Date().getDate() - 1)
    await openSanctionsProvider.delta(repo, '2024-01-01', yesterday)
  })
})
