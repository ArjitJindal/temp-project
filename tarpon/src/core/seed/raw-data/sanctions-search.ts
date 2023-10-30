import { uuid4 } from '@sentry/utils'
import { SanctionsSearchHistory } from '@/@types/openapi-internal/SanctionsSearchHistory'

export const businessSanctionsSearch = (
  username: string
): SanctionsSearchHistory => {
  const id = uuid4()
  return {
    _id: id,
    request: {
      searchTerm: username,
    },
    response: {
      total: 100,
      data: [
        {
          doc: {
            id: 'G4C22IUVXN9JYBZ',
            last_updated_utc: new Date(),
            types: [
              'adverse-media',
              'adverse-media-v2-fraud-linked',
              'adverse-media-v2-general-aml-cft',
              'adverse-media-v2-other-minor',
              'adverse-media-v2-other-serious',
              'adverse-media-v2-property',
              'adverse-media-v2-terrorism',
              'adverse-media-v2-violence-aml-cft',
              'sanction',
            ],
            name: username,
            entity_type: 'organisation',
            keywords: [],
          },
          score: 1.7,
        },
      ],
      rawComplyAdvantageResponse: {},
      searchId: '229b87fa-05ab-4b1d-82f8-b2df32fdcab7',
    },
    createdAt: 1683301138980,
  }
}

export const consumerSanctionsSearch = (
  username: string
): SanctionsSearchHistory => {
  const id = uuid4()
  return {
    _id: id,
    request: {
      searchTerm: username,
    },
    response: {
      total: 100,
      data: [
        {
          doc: {
            id: 'G4C22IUVXN9JYBZ',
            last_updated_utc: new Date(),
            types: [
              'adverse-media',
              'adverse-media-v2-fraud-linked',
              'adverse-media-v2-general-aml-cft',
              'adverse-media-v2-other-minor',
              'adverse-media-v2-other-serious',
              'adverse-media-v2-property',
              'adverse-media-v2-terrorism',
              'adverse-media-v2-violence-aml-cft',
              'sanction',
            ],
            name: username,
            entity_type: 'person',
            keywords: [],
          },
          score: 1.7,
        },
      ],
      rawComplyAdvantageResponse: {},
      searchId: id,
    },
    createdAt: 1683301138980,
  }
}
