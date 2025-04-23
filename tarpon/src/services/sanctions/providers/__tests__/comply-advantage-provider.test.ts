import {
  complyAdvantageDocToEntity,
  getSources,
} from '../comply-advantage-provider'
import { ComplyAdvantageSearchHitDoc } from '@/@types/openapi-internal/ComplyAdvantageSearchHitDoc'
import { SanctionsSource } from '@/@types/openapi-internal/SanctionsSource'
import { ComplyAdvantageSearchHit } from '@/@types/openapi-internal/ComplyAdvantageSearchHit'
import { SanctionsEntity } from '@/@types/openapi-internal/SanctionsEntity'

describe('getSources', () => {
  it('should return an empty object if sources are undefined', () => {
    const doc: ComplyAdvantageSearchHitDoc = {
      source_notes: {},
      fields: [],
    }

    const result = getSources(doc)
    expect(result).toEqual({})
  })

  it('should correctly categorize sources into media, pep, and sanctions', () => {
    const doc: ComplyAdvantageSearchHitDoc = {
      sources: ['source1', 'source2', 'source3'],
      source_notes: {
        source1: {
          aml_types: ['adverse-media'],
          name: 'Source 1',
          url: 'http://source1.com',
        },
        source2: {
          aml_types: ['pep'],
          name: 'Source 2',
          url: 'http://source2.com',
        },
        source3: {
          aml_types: ['sanctions'],
          name: 'Source 3',
          url: 'http://source3.com',
        },
      },
      fields: [
        { name: 'field1', value: 'value1', source: 'source1' },
        { name: 'field2', value: 'value2', source: 'source2' },
        { name: 'field3', value: 'value3', source: 'source3' },
      ],
    }

    const expectedMediaSource: SanctionsSource = {
      name: 'Source 1',
      url: 'http://source1.com',
      countryCodes: undefined,
      fields: [{ name: 'field1', values: ['value1'] }],
      createdAt: undefined,
      endedAt: undefined,
      media: undefined,
    }

    const expectedPepSource: SanctionsSource = {
      name: 'Source 2',
      url: 'http://source2.com',
      countryCodes: undefined,
      fields: [{ name: 'field2', values: ['value2'] }],
      createdAt: undefined,
      endedAt: undefined,
    }

    const expectedSanctionsSource: SanctionsSource = {
      name: 'Source 3',
      url: 'http://source3.com',
      countryCodes: undefined,
      fields: [{ name: 'field3', values: ['value3'] }],
      createdAt: undefined,
      endedAt: undefined,
    }

    const result = getSources(doc)
    expect(result.mediaSources).toEqual([expectedMediaSource])
    expect(result.pepSources).toEqual([expectedPepSource])
    expect(result.sanctionsSources).toEqual([expectedSanctionsSource])
  })

  it('should include media when mapping media sources', () => {
    const doc: ComplyAdvantageSearchHitDoc = {
      sources: ['source1'],
      source_notes: {
        source1: {
          aml_types: ['adverse-media'],
          name: 'Source 1',
          url: 'http://source1.com',
        },
      },
      fields: [{ name: 'field1', value: 'value1', source: 'source1' }],
      media: [{ title: 'media1' }, { title: 'media2' }],
    }

    const expectedSource: SanctionsSource = {
      name: 'Source 1',
      url: 'http://source1.com',
      countryCodes: undefined,
      fields: [{ name: 'field1', values: ['value1'] }],
      createdAt: undefined,
      endedAt: undefined,
      media: [{ title: 'media1' }, { title: 'media2' }],
    }

    const result = getSources(doc)
    expect(result.mediaSources).toEqual([expectedSource])
  })
})

describe('complyAdvantageDocToEntity', () => {
  it('should correctly convert a ComplyAdvantageSearchHit to SanctionsEntity', () => {
    const hit: ComplyAdvantageSearchHit = {
      doc: {
        id: '123',
        name: 'John Doe',
        types: ['sanction'],
        aka: [{ name: 'Alias1' }],
        entity_type: 'PERSON',
        last_updated_utc: new Date('2023-09-01T00:00:00Z'),
        fields: [
          { name: 'Country', value: 'US', source: 'source1' },
          { name: 'Year of Birth', value: '1980', source: 'source1' },
          { name: 'Gender', value: 'Male', source: 'source1' },
        ],
        sources: ['source1'],
        source_notes: {
          source1: {
            aml_types: ['sanctions'],
            name: 'Source 1',
            url: 'http://source1.com',
          },
        },
        associates: [{ name: 'Associate1' }],
      },
      match_types: ['aka_exact'],
      match_types_details: [
        {
          name_matches: [
            {
              match_types: ['exact_match'],
            },
          ],
          secondary_matches: [
            {
              match_types: ['exact_birth_year_match'],
            },
          ],
          sources: ['source1'],
          matching_name: 'John Doe',
          aml_types: ['sanctions'],
        },
      ],
    }

    const expectedEntity: SanctionsEntity = {
      id: '123',
      name: 'John Doe',
      countries: ['US'],
      types: ['sanction'],
      matchTypes: ['aka_exact'],
      aka: ['Alias1'],
      entityType: 'PERSON',
      updatedAt: new Date('2023-09-01T00:00:00Z').getTime(),
      yearOfBirth: ['1980'],
      gender: 'Male',
      matchTypeDetails: [
        {
          nameMatches: [
            {
              match_types: ['exact_match'],
            },
          ],
          secondaryMatches: [
            {
              match_types: ['exact_birth_year_match'],
            },
          ],
          sources: ['source1'],
          matchingName: 'John Doe',
          amlTypes: ['sanctions'],
        },
      ],
      nameMatched: true,
      dateMatched: true,
      associates: [{ name: 'Associate1', association: 'Associate1' }],
      sanctionSearchTypes: ['SANCTIONS'],
      pepSources: [],
      mediaSources: [],
      sanctionsSources: [
        {
          name: 'Source 1',
          url: 'http://source1.com',
          fields: [
            { name: 'Country', values: ['US'] },
            { name: 'Year of Birth', values: ['1980'] },
            { name: 'Gender', values: ['Male'] },
          ],
        },
      ],
      otherSources: [
        {
          type: 'WARNINGS',
          value: [],
        },
      ],
      rawResponse: hit,
    }

    const result = complyAdvantageDocToEntity(hit)
    expect(result).toEqual(expectedEntity)
  })

  it('should handle empty fields and undefined fields gracefully', () => {
    const hit: ComplyAdvantageSearchHit = {
      doc: {
        id: '123',
        name: 'Tim',
        types: [],
        aka: [],
        entity_type: 'PERSON',
        last_updated_utc: undefined,
        fields: [],
        source_notes: {},
        associates: [],
      },
      match_types: [],
      match_types_details: [],
    }

    const expectedEntity: SanctionsEntity = {
      id: '123',
      name: 'Tim',
      countries: [],
      types: [],
      matchTypes: [],
      aka: [],
      entityType: 'PERSON',
      sanctionSearchTypes: [],
      matchTypeDetails: [],
      nameMatched: false,
      dateMatched: false,
      associates: [],
      rawResponse: hit,
    }

    const result = complyAdvantageDocToEntity(hit)
    expect(result).toEqual(expectedEntity)
  })
})
