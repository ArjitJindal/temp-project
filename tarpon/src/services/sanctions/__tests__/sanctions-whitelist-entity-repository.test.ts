import { getTestTenantId } from '@/test-utils/tenant-test-utils'
import { dynamoDbSetupHook } from '@/test-utils/dynamodb-test-utils'
import { ComplyAdvantageSearchHit } from '@/@types/openapi-internal/ComplyAdvantageSearchHit'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import { SanctionsWhitelistEntityRepository } from '@/services/sanctions/repositories/sanctions-whitelist-entity-repository'

dynamoDbSetupHook()

const SUBJECT_1 = {
  userId: 'test_business_user_id',
  entityType: 'DIRECTOR',
  searchTerm: 'John Dow',
} as const

const SUBJECT_2 = {
  userId: 'test_business_user_id_2',
  entityType: 'DIRECTOR',
  searchTerm: 'Vladimir Putin',
} as const

describe('Whitelist repository', () => {
  const TEST_TENANT_ID = getTestTenantId()

  describe('Matching', () => {
    let repo: SanctionsWhitelistEntityRepository
    beforeAll(async () => {
      const mongoDb = await getMongoDbClient()
      repo = new SanctionsWhitelistEntityRepository(TEST_TENANT_ID, mongoDb)
    })
    beforeEach(async () => {
      await repo.clear()
    })

    test('Adding entries should not duplicate', async () => {
      await repo.addWhitelistEntities([SAMPLE_HIT_1.doc], SUBJECT_1)
      await repo.addWhitelistEntities([SAMPLE_HIT_1.doc], SUBJECT_1)
      const entries = await repo.getWhitelistEntities(
        [SAMPLE_HIT_1.doc?.id as string],
        SUBJECT_1
      )
      expect(entries).toHaveLength(1)
    })

    describe('Single entity in list', () => {
      beforeEach(async () => {
        await repo.addWhitelistEntities([SAMPLE_HIT_1.doc], SUBJECT_1)
      })

      test('Should not match with partial subject match', async () => {
        expect(
          await repo.matchWhitelistEntities([SAMPLE_HIT_1.doc?.id as string], {
            userId: SUBJECT_1.userId,
          })
        ).toBe(false)
        expect(
          await repo.matchWhitelistEntities([SAMPLE_HIT_1.doc?.id as string], {
            userId: SUBJECT_1.userId,
            entityType: SUBJECT_1.entityType,
          })
        ).toBe(false)
      })

      test('Should match when subject matches fully', async () => {
        expect(
          await repo.matchWhitelistEntities(
            [SAMPLE_HIT_1.doc?.id as string],
            SUBJECT_1
          )
        ).toBe(true)
      })

      test('Should not match when subject matches fully but for other entity', async () => {
        expect(
          await repo.matchWhitelistEntities(
            [SAMPLE_HIT_2.doc?.id as string],
            SUBJECT_1
          )
        ).toBe(false)
      })
    })

    describe('Multiple whitelist entities with the same subject', () => {
      beforeEach(async () => {
        await repo.addWhitelistEntities(
          [SAMPLE_HIT_1.doc, SAMPLE_HIT_2.doc],
          SUBJECT_1
        )
      })

      test('Should not match with partial subject match', async () => {
        expect(
          await repo.matchWhitelistEntities([SAMPLE_HIT_1.doc?.id as string], {
            userId: SUBJECT_1.userId,
          })
        ).toBe(false)
        expect(
          await repo.matchWhitelistEntities([SAMPLE_HIT_2.doc?.id as string], {
            userId: SUBJECT_1.userId,
          })
        ).toBe(false)
      })

      test('Should match when subject matches fully for both entities', async () => {
        expect(
          await repo.matchWhitelistEntities(
            [SAMPLE_HIT_1.doc?.id as string],
            SUBJECT_1
          )
        ).toBe(true)
        expect(
          await repo.matchWhitelistEntities(
            [SAMPLE_HIT_2.doc?.id as string],
            SUBJECT_1
          )
        ).toBe(true)
      })
      test('Should match when subject matches fully for any entities', async () => {
        expect(
          await repo.matchWhitelistEntities(
            [SAMPLE_HIT_1.doc?.id as string, SAMPLE_HIT_2.doc?.id as string],
            SUBJECT_1
          )
        ).toBe(true)
      })
    })

    describe('Multiple whitelist entities with the different subjects', () => {
      beforeEach(async () => {
        await repo.addWhitelistEntities([SAMPLE_HIT_1.doc], SUBJECT_1)
        await repo.addWhitelistEntities([SAMPLE_HIT_2.doc], SUBJECT_2)
      })

      test('Should not match with partial subject match', async () => {
        expect(
          await repo.matchWhitelistEntities([SAMPLE_HIT_1.doc?.id as string], {
            userId: SUBJECT_1.userId,
          })
        ).toBe(false)
        expect(
          await repo.matchWhitelistEntities([SAMPLE_HIT_2.doc?.id as string], {
            userId: SUBJECT_2.userId,
          })
        ).toBe(false)
      })

      test('Should not match when subject matches fully but entity is is not', async () => {
        expect(
          await repo.matchWhitelistEntities(
            [SAMPLE_HIT_1.doc?.id as string],
            SUBJECT_2
          )
        ).toBe(false)
      })

      test('Should match when subject matches fully for at least one', async () => {
        expect(
          await repo.matchWhitelistEntities(
            [SAMPLE_HIT_1.doc?.id as string, SAMPLE_HIT_2.doc?.id as string],
            SUBJECT_1
          )
        ).toBe(true)
      })
    })
  })
})

const SAMPLE_HIT_1: ComplyAdvantageSearchHit = {
  doc: {
    id: 'LIZCQ58HX6MYKMO',
    last_updated_utc: new Date('2024-06-20T10:09:30Z'),
    fields: [],
    types: ['adverse-media'],
    name: 'Vladimir Putiin',
    entity_type: 'person',
    aka: [
      {
        name: 'Vladimir Putin',
      },
    ],
    sources: ['company-am'],
    keywords: [],
    media: [],
    source_notes: {
      'company-am': {
        aml_types: ['adverse-media', 'adverse-media-v2-other-minor'],
        country_codes: ['AU', 'CZ'],
        name: 'company AM',
      },
    },
  },
  match_types: ['aka_exact'],
  match_types_details: [],
  score: 1.7,
}

const SAMPLE_HIT_2: ComplyAdvantageSearchHit = {
  doc: {
    id: 'XXXXXXXXXXXXXX1',
    last_updated_utc: new Date('2024-06-20T10:09:30Z'),
    fields: [],
    types: ['adverse-media'],
    name: 'Igor Sechin',
    entity_type: 'person',
    aka: [
      {
        name: 'Igor Sechin',
      },
    ],
    sources: ['company-am'],
    keywords: [],
    media: [],
    source_notes: {
      'company-am': {
        aml_types: ['adverse-media', 'adverse-media-v2-other-minor'],
        country_codes: ['AU', 'CZ'],
        name: 'company AM',
      },
    },
  },
  match_types: ['aka_exact'],
  match_types_details: [],
  score: 1.7,
}
